import { useState, useEffect } from "react";
import { syncOfflineSales, cacheProducts } from "@/lib/sync";
import { offlineDb } from "@/lib/offline-db";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const updatePending = async () => {
      const count = await offlineDb.sales.where("synced").equals(0).count();
      setPendingCount(count);
    };

    updatePending();

    const handleOnline = async () => {
      setIsOnline(true);
      if (!user) return;
      const pending = await offlineDb.sales.where("synced").equals(0).count();
      if (pending > 0) {
        toast.info(`Sinkronisasi ${pending} transaksi offline...`);
        const result = await syncOfflineSales(user.id);
        if (result.synced > 0) toast.success(`${result.synced} transaksi berhasil disinkronkan`);
        if (result.failed > 0) toast.error(`${result.failed} transaksi gagal sync`);
        updatePending();
      }
      await cacheProducts();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Offline — transaksi akan disimpan lokal");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cache products saat pertama load online
    if (navigator.onLine) cacheProducts();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  return { isOnline, pendingCount };
}
