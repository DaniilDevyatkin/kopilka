"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppIcon } from "@/components/icons";
import styles from "./pwa.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallKind = "installed" | "prompt" | "ios" | "manual" | "unsupported";

interface PwaContextValue {
  installKind: InstallKind;
  install: () => Promise<boolean>;
  online: boolean;
  standalone: boolean;
  updateAvailable: boolean;
  applyUpdate: () => void;
}

const PwaContext = createContext<PwaContextValue>({
  installKind: "unsupported",
  install: async () => false,
  online: true,
  standalone: false,
  updateAvailable: false,
  applyUpdate: () => undefined,
});

function isStandalone(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent);
}

export function PwaRuntime({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installKind, setInstallKind] = useState<InstallKind>("unsupported");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const refreshingRef = useRef(false);
  const updateRequestedRef = useRef(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const standaloneMode = isStandalone();
      setOnline(navigator.onLine);
      setStandalone(standaloneMode);
      document.documentElement.dataset.displayMode = standaloneMode
        ? "standalone"
        : "browser";
      if (standaloneMode) setInstallKind("installed");
      else if (isIosDevice()) setInstallKind("ios");
      else setInstallKind("manual");
    }, 0);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallKind("prompt");
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setInstallKind("installed");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let removeWorkerListeners = () => undefined;
    const onControllerChange = () => {
      if (!updateRequestedRef.current || refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((registration) => {
          registrationRef.current = registration;
          if (registration.waiting && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
          const onUpdateFound = () => {
            const installing = registration.installing;
            if (!installing) return;
            const onStateChange = () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateAvailable(true);
              }
            };
            installing.addEventListener("statechange", onStateChange);
          };
          registration.addEventListener("updatefound", onUpdateFound);
          removeWorkerListeners = () => {
            registration.removeEventListener("updatefound", onUpdateFound);
          };
        })
        .catch(() => {
          registrationRef.current = null;
        });
    }

    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      removeWorkerListeners();
    };
  }, []);

  const applyUpdate = useCallback(() => {
    updateRequestedRef.current = true;
    registrationRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      return true;
    }
    return false;
  }, [installPrompt]);

  const value = useMemo(
    () => ({
      installKind,
      install,
      online,
      standalone,
      updateAvailable,
      applyUpdate,
    }),
    [applyUpdate, install, installKind, online, standalone, updateAvailable],
  );

  return (
    <PwaContext.Provider value={value}>
      {online ? null : (
        <div className={styles.offlineBanner} role="status">
          <AppIcon name="offline" size={20} />
          <span>Нет сети — финансовые изменения временно недоступны.</span>
        </div>
      )}
      {updateAvailable ? (
        <div className={styles.updateBanner} role="status">
          <span>Доступно обновление Копилки</span>
          <button type="button" onClick={applyUpdate}>
            Обновить
          </button>
        </div>
      ) : null}
      {children}
    </PwaContext.Provider>
  );
}

export function usePwaRuntime(): PwaContextValue {
  return useContext(PwaContext);
}
