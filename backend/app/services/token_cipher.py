from __future__ import annotations

import base64
import hashlib
import hmac
import os

from app.errors import ApiError


class TokenCipher:
    """
    Lightweight symmetric encryption helper for token-at-rest protection.
    Uses XOR stream from SHA-256-based keystream and HMAC integrity.
    """

    def __init__(self, secret: str):
        if not secret:
            raise ValueError("TOKEN_ENCRYPTION_KEY must not be empty")
        self._key = hashlib.sha256(secret.encode("utf-8")).digest()

    def _keystream(self, nonce: bytes, length: int) -> bytes:
        output = bytearray()
        counter = 0
        while len(output) < length:
            block = hashlib.sha256(self._key + nonce + counter.to_bytes(8, "big")).digest()
            output.extend(block)
            counter += 1
        return bytes(output[:length])

    def encrypt(self, plaintext: str) -> str:
        if plaintext == "":
            return ""
        nonce = os.urandom(16)
        plain = plaintext.encode("utf-8")
        stream = self._keystream(nonce, len(plain))
        ciphertext = bytes(a ^ b for a, b in zip(plain, stream, strict=True))
        tag = hmac.new(self._key, nonce + ciphertext, digestmod=hashlib.sha256).digest()
        payload = nonce + tag + ciphertext
        return base64.urlsafe_b64encode(payload).decode("ascii")

    def decrypt(self, encoded: str) -> str:
        if encoded == "":
            return ""
        try:
            payload = base64.urlsafe_b64decode(encoded.encode("ascii"))
        except Exception as exc:  # noqa: BLE001
            raise ApiError(500, "token_decrypt_failed", "Cannot decode encrypted token.") from exc

        if len(payload) < 48:
            raise ApiError(500, "token_decrypt_failed", "Encrypted token has invalid format.")

        nonce = payload[:16]
        tag = payload[16:48]
        ciphertext = payload[48:]
        expected = hmac.new(self._key, nonce + ciphertext, digestmod=hashlib.sha256).digest()
        if not hmac.compare_digest(tag, expected):
            raise ApiError(500, "token_decrypt_failed", "Encrypted token integrity check failed.")

        stream = self._keystream(nonce, len(ciphertext))
        plain = bytes(a ^ b for a, b in zip(ciphertext, stream, strict=True))
        return plain.decode("utf-8")
