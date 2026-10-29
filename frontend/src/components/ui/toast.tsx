"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";

export const toast = Toast.createToastManager();

export function FeedbackToast({ message, type = "info" }: { message: string; type?: "success" | "error" | "warning" | "info" }) {
  useEffect(() => {
    if (message) toast.add({ description: message, type, timeout: type === "error" ? 8000 : 5000, priority: type === "error" ? "high" : "low" });
  }, [message, type]);
  return null;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => {
    const Icon = item.type === "success" ? CheckCircle2 : item.type === "error" ? CircleAlert : item.type === "warning" ? TriangleAlert : Info;
    return <Toast.Root key={item.id} toast={item} className="pointer-events-auto rounded-lg border border-stroke bg-white p-4 text-dark shadow-lg data-[limited]:hidden dark:border-dark-3 dark:bg-gray-dark dark:text-white">
      <Toast.Content className="flex items-start gap-3">
        <Icon aria-hidden className={item.type === "error" ? "size-5 shrink-0 text-red-600" : item.type === "success" ? "size-5 shrink-0 text-green-600" : "size-5 shrink-0 text-primary"} />
        <div className="min-w-0 flex-1"><Toast.Title className="font-semibold" /><Toast.Description className="break-words text-sm" />{item.actionProps && <Toast.Action className="mt-2 text-sm font-semibold text-primary" />}</div>
        <Toast.Close aria-label="Fechar notificação" className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" /></Toast.Close>
      </Toast.Content>
    </Toast.Root>;
  });
}

export function Toaster() {
  return <Toast.Provider toastManager={toast} limit={3}><Toast.Portal><Toast.Viewport aria-label="Notificações" className="pointer-events-none fixed right-4 top-4 z-[100000] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-3 outline-none"><ToastList /></Toast.Viewport></Toast.Portal></Toast.Provider>;
}
