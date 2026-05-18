import { useOffline } from "@/hooks/use-offline";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { syncOfflineSales } from "@/lib/sync";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOffline();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!user || !isOnline) return;
    setSyncing(true);
    const result = await syncOfflineSales(user.id);
    setSyncing(false);
    if (result.synced > 0) toast.success(`${result.synced} transaksi disinkronkan`);
    else toast.info("Tidak ada transaksi pending");
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={["fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg", isOnline ? "bg-yellow-100 text-yellow-800 border border-yellow-300" : "bg-red-100 text-red-800 border border-red-300"].join(" ")}>
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {isOnline ? (
        <span>{pendingCount} transaksi pending</span>
      ) : (
        <span>Offline Mode</span>
      )}
      {isOnline && pendingCount > 0 && (
        <button onClick={handleManualSync} disabled={syncing} className="ml-1 hover:opacity-70">
          <RefreshCw className={["h-4 w-4", syncing ? "animate-spin" : ""].join(" ")} />
        </button>
      )}
    </div>
  );
}
