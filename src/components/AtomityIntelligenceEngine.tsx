import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import './tokens.css';

// --- Types ---
interface RawPost {
  userId: number;
  id: number;
  title: string;
}

interface ResourceItem {
  clusterId: string;
  namespaceId: string;
  cpuUsage: number;
  memoryUsage: number;
  category: string;
  originalName: string;
  status: 'healthy' | 'warning' | 'critical';
  logs: { ts: string, lvl: 'info'|'warn'|'err', msg: string }[];
}

// --- Data Fetching & Mapping ---
const generateMockLogs = (seed: number) => {
  const count = 5 + (seed % 10);
  return Array.from({ length: count }).map((_, i) => ({
    ts: new Date(Date.now() - (i * 1000 * 60)).toISOString().split('T')[1].slice(0, -5),
    lvl: i % 7 === 0 ? 'err' : i % 4 === 0 ? 'warn' : 'info' as any,
    msg: i % 3 === 0 ? `Connection to sidecar proxy established` : `Reconciling replica set state [gen-${seed}]`
  }));
};

const fetchCloudData = async (): Promise<ResourceItem[]> => {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts');
  if (!res.ok) throw new Error('Network response was not ok');
  const posts: RawPost[] = await res.json();
  
  return posts.slice(0, 30).map((post, i) => {
    const clusterNum = (post.userId % 3) + 1;
    const cpu = Math.max(10, post.title.length * 3); 
    
    return {
      clusterId: `Cluster-0${clusterNum}`,
      namespaceId: `ns-${post.id.toString().padStart(4, '0')}`,
      cpuUsage: cpu,
      memoryUsage: cpu * 2.5 + Math.random() * 50,
      category: i % 3 === 0 ? 'Production' : i % 2 === 0 ? 'Staging' : 'Development',
      originalName: post.title.split(' ').slice(0, 2).join('-'),
      status: cpu > 180 ? 'critical' : cpu > 100 ? 'warning' : 'healthy',
      logs: generateMockLogs(post.id)
    };
  });
};

// --- Animations ---
const springConfig = { type: 'spring', stiffness: 300, damping: 30 };
const staggerConfig = { transition: { staggerChildren: 0.05 } };
const fadeUpConfig = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// --- Components ---
const AnimatedCounter = ({ value, suffix = '' }: { value: number, suffix?: string }) => {
  const [display, setDisplay] = useState("0" + suffix);
  const prefersReducedMotion = useReducedMotion();
  const springValue = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplay(Math.round(latest).toLocaleString() + suffix);
    });
    return () => unsubscribe();
  }, [springValue, suffix]);

  useEffect(() => {
    if (prefersReducedMotion) springValue.jump(value);
    else springValue.set(value);
  }, [value, springValue, prefersReducedMotion]);

  return <>{display}</>;
};

const SpotlightCard = ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      onClick={onClick}
      className="spotlight-card"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div 
        className="spotlight-glow"
        style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, var(--border-focus), transparent 40%)` }}
      />
      <div className="spotlight-content">{children}</div>
    </div>
  );
};

// --- Main Engine ---
export const AtomityIntelligenceEngine = () => {
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Navigation State: 'global' | 'cluster' | 'namespace'
  const [level, setLevel] = useState<'global' | 'cluster' | 'namespace'>('global');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [activeNsId, setActiveNsId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['cloudResources'], queryFn: fetchCloudData, staleTime: 300000 });

  const clusters = useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, item) => {
      if (!acc[item.clusterId]) acc[item.clusterId] = [];
      acc[item.clusterId].push(item);
      return acc;
    }, {} as Record<string, ResourceItem[]>);
  }, [data]);

  if (isLoading || !data) return <div className="atomity-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Syncing telemetry...</div>;

  // View Computations
  const displayData = level === 'global' ? data : (clusters[activeClusterId!] || []);
  const activeItem = level === 'namespace' ? displayData.find(d => d.namespaceId === activeNsId) : null;
  
  const totalCpu = level === 'namespace' && activeItem ? activeItem.cpuUsage : displayData.reduce((sum, item) => sum + item.cpuUsage, 0);
  const totalMem = Math.round(level === 'namespace' && activeItem ? activeItem.memoryUsage : displayData.reduce((sum, item) => sum + item.memoryUsage, 0));
  const activeNodes = level === 'namespace' ? 1 : (level === 'cluster' ? displayData.length : Object.keys(clusters).length);

  // Navigation Handlers
  const goGlobal = () => { setLevel('global'); setActiveClusterId(null); setActiveNsId(null); };
  const goCluster = (cid: string) => { setLevel('cluster'); setActiveClusterId(cid); setActiveNsId(null); };
  const goNamespace = (nsid: string) => { setLevel('namespace'); setActiveNsId(nsid); };

  const goBack = () => {
    if (level === 'namespace') {
      setLevel('cluster');
      setActiveNsId(null);
    } else if (level === 'cluster') {
      goGlobal();
    }
  };

  return (
    <section className="atomity-container">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        
        {/* Header Block & Controls */}
        <motion.div layout style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 className="atomity-header">Atomity Intelligence</h2>
            <p className="atomity-subheader" style={{ marginBottom: 0 }}>
              Deep observability into cloud economics. A comprehensive, real-time mapping of global infrastructural hierarchy.
            </p>
          </div>
          <button 
            className="pill" 
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-panel)' }}
          >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </motion.div>

        {/* Dynamic Breadcrumbs Map and Back Button */}
        <motion.div layout style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <AnimatePresence>
            {level !== 'global' && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, width: 0 }}
                className="pill back-btn"
                onClick={goBack}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-panel)', padding: '0.25rem 0.75rem', height: 'fit-content' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                Back
              </motion.button>
            )}
          </AnimatePresence>

          <div className="breadcrumbs" style={{ marginBottom: 0 }}>
          <button className={`breadcrumb-item ${level === 'global' ? 'breadcrumb-active' : ''}`} onClick={goGlobal}>Global Org</button>
          
          <AnimatePresence>
            {(level === 'cluster' || level === 'namespace') && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, width: 0 }} style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ opacity: 0.3 }}>/</span>
                <button className={`breadcrumb-item ${level === 'cluster' ? 'breadcrumb-active' : ''}`} onClick={() => goCluster(activeClusterId!)}>
                  {activeClusterId}
                </button>
              </motion.div>
            )}
            
            {level === 'namespace' && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, width: 0 }} style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ opacity: 0.3 }}>/</span>
                <span className="breadcrumb-active">{activeNsId}</span>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </motion.div>

        {/* Dynamic Metric Cards */}
        <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <SpotlightCard>
            <div className="metric-label">Assigned Processor Cores</div>
            <div className="metric-value"><AnimatedCounter value={totalCpu} /> <span className="metric-unit">m</span></div>
          </SpotlightCard>
          <SpotlightCard>
            <div className="metric-label">Heap Memory Allocation</div>
            <div className="metric-value"><AnimatedCounter value={totalMem} /> <span className="metric-unit">MiB</span></div>
          </SpotlightCard>
          <SpotlightCard>
            <div className="metric-label">{level === 'global' ? 'Monitored Regions' : level === 'cluster' ? 'Active Pods' : 'Network Policy'}</div>
            <div className="metric-value">
              {level === 'namespace' ? 'Strict' : <AnimatedCounter value={activeNodes} />}
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Deep Morphing Layout Container */}
        <motion.div layout className="spotlight-card" style={{ padding: '0' }}>
          
          {/* Top Panel: The Morphing Chart */}
          <motion.div layout style={{ padding: '2rem' }}>
            <div className="metric-label" style={{ marginBottom: '1rem' }}>
              {level === 'global' ? "Macro Resource Topography" : 
               level === 'cluster' ? `${activeClusterId} Node Distribution` : 
               "Pod Resource Signature"}
            </div>
            
            <div className="chart-container">
              <AnimatePresence mode="popLayout">
                {level === 'global' ? Object.entries(clusters).map(([clusterId, namespaces]) => (
                  <motion.div 
                    key={clusterId}
                    {...fadeUpConfig}
                    className="chart-bar-group"
                    onClick={() => goCluster(clusterId)}
                  >
                    {namespaces.map((ns) => (
                      <motion.div
                        key={`ns-bar-${ns.namespaceId}`}
                        layoutId={`ns-morph-${ns.namespaceId}`}
                        className="chart-bar-segment"
                        style={{ height: `${ns.cpuUsage * 0.15}px`, opacity: 0.8 }}
                        transition={springConfig}
                      />
                    ))}
                    <div className="chart-label">{clusterId}</div>
                  </motion.div>
                )) : level === 'cluster' ? clusters[activeClusterId!].map((ns) => (
                  <motion.div
                    key={`ns-group-${ns.namespaceId}`}
                    {...fadeUpConfig}
                    className="chart-bar-group"
                    onClick={() => goNamespace(ns.namespaceId)}
                  >
                    <motion.div
                      layoutId={`ns-morph-${ns.namespaceId}`}
                      className="chart-bar-segment"
                      style={{ height: `${ns.cpuUsage * 0.5}px` }}
                      transition={springConfig}
                    />
                    <div className="chart-label" style={{ opacity: 0.5 }}>{ns.namespaceId.split('-')[1]}</div>
                  </motion.div>
                )) : (
                  // Level = Namespace
                  <motion.div
                    key="isolation-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <motion.div
                      layoutId={`ns-morph-${activeNsId}`}
                      className="chart-bar-segment"
                      style={{ height: `${activeItem!.cpuUsage * 0.8}px`, width: '100px', backgroundColor: 'var(--accent)', boxShadow: '0 0 40px var(--accent-glow)' }}
                      transition={springConfig}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Bottom Panel: The Table or Detail View */}
          <motion.div layout style={{ backgroundColor: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
            <AnimatePresence mode="wait">
              {level !== 'namespace' ? (
                <motion.div key="table-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Target Signature</th>
                          <th>Environment</th>
                          <th>Processor Limit</th>
                          <th>Memory Limit</th>
                          <th>Health Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence mode="popLayout">
                          {displayData.map((item) => (
                            <motion.tr 
                              key={item.namespaceId}
                              layout
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="data-row"
                              onClick={() => {
                                if (level === 'global') goCluster(item.clusterId);
                                else goNamespace(item.namespaceId);
                              }}
                            >
                              <td>
                                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{item.namespaceId}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.originalName}</div>
                              </td>
                              <td><span className="pill">{item.category}</span></td>
                              <td>{item.cpuUsage}m</td>
                              <td>{Math.round(item.memoryUsage)} MiB</td>
                              <td>
                                <div className="status-indicator">
                                  <div className={`status-dot ${item.status}`} />
                                  <span>{item.status}</span>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ) : activeItem && (
                <motion.div 
                  key="detail-view" 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  style={{ padding: '2rem' }}
                >
                  <div className="metric-value">Deep Inspection: {activeItem.namespaceId}</div>
                  <div className="detail-grid">
                    <div>
                      <h4 className="metric-label" style={{ marginBottom: '1rem' }}>Configuration Identity</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Original Map:</span> <span style={{ color: 'var(--text-main)' }}>{activeItem.originalName}</span></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Deployment Layer:</span> <span className="pill">{activeItem.category}</span></div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Current Status:</span> 
                          <div className="status-indicator" style={{ display: 'inline-flex', marginLeft: '0.5rem' }}>
                            <div className={`status-dot ${activeItem.status}`} />
                            <span style={{ color: 'var(--text-main)' }}>{activeItem.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="metric-label" style={{ marginBottom: '1rem' }}>Live Container Logs</h4>
                      <div className="log-view">
                        {activeItem.logs.map((log, i) => (
                          <div key={i} className="log-line">
                            <span className="ts">[{log.ts}]</span>
                            <span className={`lvl ${log.lvl}`}>{log.lvl.toUpperCase()}</span>
                            <span className="msg">{log.msg}</span>
                          </div>
                        ))}
                        <div className="log-line">
                          <span className="ts">[{new Date().toISOString().split('T')[1].slice(0, -5)}]</span>
                          <span className="lvl info">SYS</span>
                          <span className="msg">Polling socket connected.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default AtomityIntelligenceEngine;
