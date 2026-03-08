from __future__ import annotations

import logging
import re
import socket
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from urllib.parse import urlparse

from app.auth.firebase_auth import FirebaseAuthService
from app.errors import ApiError


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
logger = logging.getLogger(__name__)


class MagicLinkEmailService:
    def __init__(self, config: dict, firebase_auth: FirebaseAuthService | None = None):
        self.config = config
        self.firebase_auth = firebase_auth or FirebaseAuthService()

    def send_sign_in_email(self, email: str) -> None:
        normalized_email = self._normalize_email(email)
        continue_url = self._resolve_continue_url()
        sign_in_link = self.firebase_auth.generate_sign_in_link(normalized_email, continue_url)
        message = self._build_email_message(normalized_email, sign_in_link)
        self._deliver_email(message)

    def _normalize_email(self, raw_email: str) -> str:
        normalized = raw_email.strip().lower()
        if not normalized or not EMAIL_PATTERN.match(normalized):
            raise ApiError(400, "invalid_request", "Please provide a valid email address.")
        return normalized

    def _resolve_continue_url(self) -> str:
        configured_url = str(self.config.get("AUTH_MAGIC_LINK_CONTINUE_URL", "")).strip()
        if configured_url:
            self._validate_public_url(configured_url, "AUTH_MAGIC_LINK_CONTINUE_URL")
            return configured_url

        frontend_url = str(self.config.get("FRONTEND_URL", "")).strip().rstrip("/")
        if not frontend_url:
            raise ApiError(500, "auth_not_configured", "FRONTEND_URL is not configured.")
        continue_url = f"{frontend_url}/dataroom"
        self._validate_public_url(continue_url, "FRONTEND_URL")
        return continue_url

    @staticmethod
    def _validate_public_url(value: str, key_name: str) -> None:
        parsed = urlparse(value)
        if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1"}:
            raise ApiError(
                500,
                "auth_not_configured",
                f"{key_name} must use https in non-local environments.",
            )

    def _build_email_message(self, recipient: str, sign_in_link: str) -> EmailMessage:
        from_email = str(self.config.get("MAIL_FROM_EMAIL", "")).strip()
        if not from_email:
            raise ApiError(500, "mail_not_configured", "MAIL_FROM_EMAIL is not configured.")

        from_name = str(self.config.get("MAIL_FROM_NAME", "Dataroom.demo")).strip() or "Dataroom.demo"
        subject = str(self.config.get("AUTH_MAGIC_LINK_SUBJECT", "Sign in to Dataroom.demo")).strip()
        if not subject:
            subject = "Sign in to Dataroom.demo"
        reply_to = str(self.config.get("MAIL_REPLY_TO", "")).strip()

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((from_name, from_email))
        message["To"] = recipient
        if reply_to:
            message["Reply-To"] = reply_to
        message["Auto-Submitted"] = "auto-generated"
        message["X-Auto-Response-Suppress"] = "All"

        message.set_content(self._render_plain_text(sign_in_link))
        message.add_alternative(self._render_html(recipient, sign_in_link), subtype="html")
        return message

    def _deliver_email(self, message: EmailMessage) -> None:
        host = str(self.config.get("MAIL_SMTP_HOST", "")).strip()
        port = int(self.config.get("MAIL_SMTP_PORT", 587))
        username = str(self.config.get("MAIL_SMTP_USERNAME", "")).strip()
        raw_password = str(self.config.get("MAIL_SMTP_PASSWORD", "")).strip()
        # Gmail app passwords are commonly copied with spaces every 4 chars.
        # SMTP login expects the compact token without spaces.
        password = "".join(raw_password.split()) if "gmail.com" in host else raw_password
        use_tls = bool(self.config.get("MAIL_SMTP_USE_TLS", True))
        use_ssl = bool(self.config.get("MAIL_SMTP_USE_SSL", False))

        if not host:
            raise ApiError(500, "mail_not_configured", "MAIL_SMTP_HOST is not configured.")
        if use_ssl and use_tls:
            raise ApiError(
                500,
                "mail_not_configured",
                "Enable either MAIL_SMTP_USE_SSL or MAIL_SMTP_USE_TLS, not both.",
            )
        if username and not password:
            raise ApiError(500, "mail_not_configured", "MAIL_SMTP_PASSWORD is not configured.")

        timeout_seconds = int(self.config.get("REQUEST_TIMEOUT_SECONDS", 20))
        context = ssl.create_default_context()

        try:
            self._send_message_via_smtp(
                smtp_host=host,
                connect_host=host,
                port=port,
                timeout_seconds=timeout_seconds,
                context=context,
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                message=message,
            )
        except OSError as exc:
            # Common on hosts without IPv6 default route when resolver prefers AAAA first.
            if exc.errno == 101:
                ipv4_host = self._resolve_first_ipv4(host, port)
                if ipv4_host:
                    logger.warning(
                        "SMTP connect failed with errno=101 for host=%s, retrying via IPv4=%s",
                        host,
                        ipv4_host,
                    )
                    self._send_message_via_smtp(
                        smtp_host=host,
                        connect_host=ipv4_host,
                        port=port,
                        timeout_seconds=timeout_seconds,
                        context=context,
                        username=username,
                        password=password,
                        use_tls=use_tls,
                        use_ssl=use_ssl,
                        message=message,
                    )
                    return
            raise
        except smtplib.SMTPAuthenticationError as exc:
            logger.exception(
                "SMTP authentication failed: host=%s port=%s tls=%s ssl=%s username_set=%s",
                host,
                port,
                use_tls,
                use_ssl,
                bool(username),
            )
            raise ApiError(
                502,
                "mail_auth_failed",
                "SMTP authentication failed. Check MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD.",
            ) from exc
        except (smtplib.SMTPConnectError, TimeoutError, OSError) as exc:
            logger.exception(
                "SMTP connection failed: host=%s port=%s tls=%s ssl=%s username_set=%s",
                host,
                port,
                use_tls,
                use_ssl,
                bool(username),
            )
            raise ApiError(
                502,
                "mail_connection_failed",
                "SMTP connection failed. Check host/port/TLS settings and server egress rules.",
            ) from exc
        except smtplib.SMTPException as exc:
            logger.exception(
                "SMTP delivery failed: host=%s port=%s tls=%s ssl=%s username_set=%s",
                host,
                port,
                use_tls,
                use_ssl,
                bool(username),
            )
            raise ApiError(
                502,
                "mail_delivery_failed",
                "Failed to send sign-in email. Please try again.",
            ) from exc

    @staticmethod
    def _resolve_first_ipv4(host: str, port: int) -> str | None:
        try:
            addresses = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
        except OSError:
            return None

        for _, _, _, _, sockaddr in addresses:
            if sockaddr and sockaddr[0]:
                return str(sockaddr[0])
        return None

    @staticmethod
    def _send_message_via_smtp(
        *,
        smtp_host: str,
        connect_host: str,
        port: int,
        timeout_seconds: int,
        context: ssl.SSLContext,
        username: str,
        password: str,
        use_tls: bool,
        use_ssl: bool,
        message: EmailMessage,
    ) -> None:
        if use_ssl:
            # Preserve TLS hostname validation for smtp_host while connecting to connect_host.
            with smtplib.SMTP_SSL(timeout=timeout_seconds, context=context) as smtp:
                smtp._host = smtp_host  # noqa: SLF001
                smtp.connect(connect_host, port)
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
            return

        # Preserve TLS hostname validation for smtp_host while connecting to connect_host.
        with smtplib.SMTP(timeout=timeout_seconds) as smtp:
            smtp._host = smtp_host  # noqa: SLF001
            smtp.connect(connect_host, port)
            smtp.ehlo()
            if use_tls:
                smtp.starttls(context=context)
                smtp.ehlo()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)

    @staticmethod
    def _render_plain_text(sign_in_link: str) -> str:
        return (
            "Sign in to Dataroom.demo\n\n"
            "Use this secure magic link to access your account:\n"
            f"{sign_in_link}\n\n"
            "If you did not request this email, you can ignore it.\n"
            "This is an automated demo message."
        )

    @staticmethod
    def _render_html(recipient: str, sign_in_link: str) -> str:
        escaped_recipient = escape(recipient)
        escaped_link = escape(sign_in_link, quote=True)
        return f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in to Dataroom.demo</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f7ff;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;">Sign in to Dataroom.demo</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;font-size:15px;line-height:1.6;color:#334155;">
                We received a sign-in request for <strong>{escaped_recipient}</strong>.
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 12px;" align="center">
                <a href="{escaped_link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:10px;">
                  Continue to Dataroom.demo
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 0;font-size:13px;line-height:1.6;color:#64748b;">
                Or open this link manually:
              </td>
            </tr>
            <tr>
              <td style="padding:2px 28px 24px;font-size:13px;line-height:1.6;word-break:break-all;">
                <a href="{escaped_link}" style="color:#2563eb;text-decoration:underline;">{escaped_link}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 26px;background:#f8fafc;font-size:12px;line-height:1.6;color:#64748b;">
                If you did not request this email, you can safely ignore it.<br />
                This is an automated demo message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
