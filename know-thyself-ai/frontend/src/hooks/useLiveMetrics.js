import { useState, useEffect, useRef, useCallback } from 'react';
import { mobileService } from '../services/api';

export function useLiveMetrics(onMetricsUpdate) {
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    is_connected: false,
    active_device_count: 0,
    last_sync_at: null,
    today_synced_summary: null,
  });
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [pairingEvent, setPairingEvent] = useState(null);

  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const onUpdateRef = useRef(onMetricsUpdate);

  useEffect(() => {
    onUpdateRef.current = onMetricsUpdate;
  }, [onMetricsUpdate]);

  const fetchDeviceStatus = useCallback(async () => {
    try {
      const res = await mobileService.getStatus();
      setDeviceStatus(res.data);
    } catch (err) {
      // Ignore polling errors
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    const token = localStorage.getItem('know_thyself_token');
    if (!token) return;

    try {
      // 1. Get a secure single-use ticket
      const ticketRes = await mobileService.getWsTicket();
      const ticket = ticketRes.data.ticket;

      // 2. Determine WebSocket host URL
      let wsBase = '';
      const rawApiBase = import.meta.env.VITE_API_BASE_URL;

      if (rawApiBase && rawApiBase.startsWith('http')) {
        wsBase = rawApiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${protocol}//${window.location.host}`;
      }

      const wsUrl = `${wsBase}/ws/metrics?ticket=${encodeURIComponent(ticket)}`;
      console.log('[LiveMetrics] Connecting to WebSocket:', wsUrl);

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('[LiveMetrics] WebSocket connected successfully');
        setIsWsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Start ping heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'metrics_update') {
            console.log('[LiveMetrics] Received live phone telemetry:', data);
            setLatestUpdate(data);
            setDeviceStatus((prev) => ({
              ...prev,
              is_connected: true,
              last_sync_at: data.synced_at || new Date().toISOString(),
              today_synced_summary: {
                ...(prev.today_synced_summary || {}),
                steps: data.current_metrics?.steps ?? prev.today_synced_summary?.steps,
                screen_time: data.current_metrics?.screen_time ?? prev.today_synced_summary?.screen_time,
                sleep_hours: data.current_metrics?.sleep_hours ?? prev.today_synced_summary?.sleep_hours,
                water_intake: data.current_metrics?.water_intake ?? prev.today_synced_summary?.water_intake,
              },
            }));

            if (onUpdateRef.current) {
              onUpdateRef.current(data);
            }
          } else if ([
            'pairing_started',
            'device_scanned',
            'device_approval_required',
            'device_connected',
            'pairing_expired',
            'pairing_failed',
            'device_disconnected'
          ].includes(data.type)) {
            console.log('[LiveMetrics] Pairing event:', data.type, data);
            setPairingEvent(data);
            if (data.type === 'device_connected' || data.type === 'device_disconnected') {
              fetchDeviceStatus();
            }
          }
        } catch (e) {
          console.error('[LiveMetrics] Message parse error:', e);
        }
      };

      socket.onclose = (event) => {
        console.log('[LiveMetrics] WebSocket closed (code:', event.code, ')');
        setIsWsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect (max 30s)
        if (localStorage.getItem('know_thyself_token')) {
          const timeout = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttemptsRef.current));
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, timeout);
        }
      };

      socket.onerror = (err) => {
        console.warn('[LiveMetrics] WebSocket error:', err);
      };
    } catch (err) {
      console.warn('[LiveMetrics] Failed to initiate WebSocket ticket:', err);
      // Retry in 5s
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    fetchDeviceStatus();
    connectWebSocket();

    // Poll device status occasionally (every 45s) as backup
    const statusInterval = setInterval(fetchDeviceStatus, 45000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(statusInterval);
    };
  }, [connectWebSocket, fetchDeviceStatus]);

  return {
    isWsConnected,
    deviceStatus,
    latestUpdate,
    pairingEvent,
    refreshDeviceStatus: fetchDeviceStatus,
  };
}
