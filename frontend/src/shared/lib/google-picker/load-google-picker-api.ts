const GOOGLE_API_SCRIPT_SRC = 'https://apis.google.com/js/api.js'

type GoogleApiNamespace = {
  load: (
    apiName: string,
    options: {
      callback: () => void
      onerror?: () => void
      timeout?: number
      ontimeout?: () => void
    },
  ) => void
}

type GooglePickerBuilder = {
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  setOrigin: (origin: string) => GooglePickerBuilder
  setAppId: (appId: string) => GooglePickerBuilder
  addView: (view: unknown) => GooglePickerBuilder
  enableFeature: (feature: string) => GooglePickerBuilder
  setCallback: (callback: (data: unknown) => void) => GooglePickerBuilder
  build: () => {
    setVisible: (visible: boolean) => void
  }
}

type GoogleDocsView = {
  setIncludeFolders: (enabled: boolean) => GoogleDocsView
  setSelectFolderEnabled: (enabled: boolean) => GoogleDocsView
}

export type GooglePickerNamespace = {
  Action: {
    PICKED: string
  }
  Feature: {
    MULTISELECT_ENABLED: string
    SUPPORT_DRIVES: string
  }
  ViewId: {
    DOCS: string
  }
  DocsView: new (viewId?: string) => GoogleDocsView
  PickerBuilder: new () => GooglePickerBuilder
}

let loadScriptPromise: Promise<void> | null = null
let loadPickerApiPromise: Promise<GooglePickerNamespace> | null = null

const getWindowGapi = (): GoogleApiNamespace | undefined => {
  const hostWindow = window as Window & { gapi?: GoogleApiNamespace }
  return hostWindow.gapi
}

const getWindowGooglePicker = (): GooglePickerNamespace | undefined => {
  const hostWindow = window as Window & {
    google?: {
      picker?: GooglePickerNamespace
    }
  }
  return hostWindow.google?.picker
}

const ensureGoogleApiScript = async (): Promise<void> => {
  if (getWindowGapi()) {
    return
  }

  if (loadScriptPromise) {
    return loadScriptPromise
  }

  loadScriptPromise = new Promise<void>((resolve, reject) => {
    const resolveWhenReady = (): boolean => {
      if (getWindowGapi()) {
        resolve()
        return true
      }
      return false
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_API_SCRIPT_SRC}"]`) as
      | HTMLScriptElement
      | null

    if (existingScript) {
      if (resolveWhenReady()) {
        return
      }

      existingScript.addEventListener('load', () => {
        if (resolveWhenReady()) {
          return
        }
        reject(new Error('Google API client is unavailable.'))
      }, { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google API script.')),
        { once: true },
      )

      window.setTimeout(() => {
        if (resolveWhenReady()) {
          return
        }
        reject(new Error('Google API script is present but did not initialize.'))
      }, 15000)
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_API_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (resolveWhenReady()) {
        return
      }
      reject(new Error('Google API client is unavailable.'))
    }
    script.onerror = () => reject(new Error('Failed to load Google API script.'))
    document.head.appendChild(script)
  })

  try {
    await loadScriptPromise
  } catch (error) {
    loadScriptPromise = null
    throw error
  }
}

export const loadGooglePicker = async (): Promise<GooglePickerNamespace> => {
  const readyPicker = getWindowGooglePicker()
  if (readyPicker) {
    return readyPicker
  }

  if (loadPickerApiPromise) {
    return loadPickerApiPromise
  }

  loadPickerApiPromise = (async () => {
    await ensureGoogleApiScript()

    const gapi = getWindowGapi()
    if (!gapi) {
      throw new Error('Google API client is unavailable.')
    }

    await new Promise<void>((resolve, reject) => {
      gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to load Google Picker API.')),
        timeout: 15000,
        ontimeout: () => reject(new Error('Google Picker API loading timed out.')),
      })
    })

    const picker = getWindowGooglePicker()
    if (!picker) {
      throw new Error('Google Picker API is unavailable.')
    }

    return picker
  })()

  try {
    return await loadPickerApiPromise
  } catch (error) {
    loadPickerApiPromise = null
    throw error
  }
}
