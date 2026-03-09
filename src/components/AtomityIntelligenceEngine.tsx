import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import './tokens.css';

// --- Types ---
interface RawPost {
  userId: number;
  id: number;
  title: string;
  body: string;
}

interface ResourceItem {
  clusterId: string;
  namespaceId: string;
  cpuUsage: number;
  memoryUsage: number;
  category: string;
  originalName: string;
  status: 'healthy' | 'warning' | 'critical';
}

// --- Data Fetching & Mapping ---
const fetchCloudData = async (): Promise<ResourceItem[]> => {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts');
  if (!res.ok) throw new Error('Network response was not ok');
  const posts: RawPost[] = await res.json();
  
  // Transform mock data into Cloud Resources
  // Take 30 items for meaningful visualization
  return posts.slice(0, 30).map((post, i) => {
    // Group into 3 clusters (User 1, 2, 3)
    const clusterNum = (post.userId % 3) + 1;
    const cpu = Math.max(10, post.title.length * 3); // CPU usage derived from title length
    
    return {
      clusterId: `Cluster-0${clusterNum}`,
      namespaceId: `ns-${post.id.toString().padStart(4, '0')}`,
      cpuUsage: cpu,
      memoryUsage: cpu * 2.5 + Math.random() * 50,
      category: i % 3 === 0 ? 'Production' : i % 2 === 0 ? 'Staging' : 'Development',
      originalName: post.title.split(' ').slice(0, 2).join('-'),
      status: cpu > 180 ? 'critical' : cpu > 100 ? 'warning' : 'healthy'
    };
  });
};

// --- Counter Animation Component ---
const AnimatedCounter = ({ value, suffix = '' }: { value: number, suffix?: string }) => {
  const [display, setDisplay] = useState("0" + suffix);
  const prefersReducedMotion = useReducedMotion();
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1
  });

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplay(Math.round(latest).toLocaleString() + suffix);
    });
    return () => unsubscribe();
  }, [springValue, suffix]);

  useEffect(() => {
    if (prefersReducedMotion) {
      springValue.jump(value);
    } else {
      springValue.set(value);
    }
  }, [value, springValue, prefersReducedMotion]);

  return <span>{display}</span>;
};

// --- Metric Card Component ---
const MetricCard = ({ title, value, unit }: { title: string, value: number, unit: string }) => {
  return (
    <div className="atomity-glass">
      <div className="atomity-text-secondary" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        {title}
      </div>
      <div className="atomity-metric-val">
        <AnimatedCounter value={value} />
        <span className="atomity-metric-unit">{unit}</span>
      </div>
    </div>
  );
};

// --- DataTable Component ---
const DataTable = ({ data, onRowClick }: { data: ResourceItem[], onRowClick: (item: ResourceItem) => void }) => {
  const prefersReducedMotion = useReducedMotion();
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="atomity-table-wrapper">
      <motion.table 
        className="atomity-table"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <thead>
          <tr>
            <th>Resource Target</th>
            <th>Environment</th>
            <th>CPU Allocation</th>
            <th>Memory Usage</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {data.map((item) => (
              <motion.tr 
                key={item.namespaceId}
                variants={itemAnim}
                layout
                onClick={() => onRowClick(item)}
              >
                <td data-label="Resource Target">
                  <div style={{ fontWeight: 500, color: 'var(--atomity-text-primary)' }}>
                    {item.namespaceId}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--atomity-text-secondary)', marginTop: '0.25rem' }}>
                    {item.originalName}
                  </div>
                </td>
                <td data-label="Environment">
                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    background: 'var(--atomity-bg-primary)',
                    border: '1px solid var(--atomity-border-glass)'
                  }}>
                    {item.category}
                  </span>
                </td>
                <td data-label="CPU Allocation"><AnimatedCounter value={item.cpuUsage} suffix="m" /></td>
                <td data-label="Memory Usage"><AnimatedCounter value={item.memoryUsage} suffix=" MiB" /></td>
                <td data-label="Status">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: item.status === 'healthy' ? 'var(--atomity-accent-base)' : 
                                       item.status === 'warning' ? '#eab308' : '#ef4444',
                      boxShadow: `0 0 8px ${item.status === 'healthy' ? 'var(--atomity-accent-base)' : 
                                           item.status === 'warning' ? '#eab308' : '#ef4444'}80`
                    }} />
                    <span style={{ textTransform: 'capitalize' }}>{item.status}</span>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </motion.table>
    </div>
  );
};

// --- Main Component ---
export const AtomityIntelligenceEngine = () => {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const prefersReducedMotion = useReducedMotion();

  // Pointer tracking for background glow
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };
    
    if (!prefersReducedMotion) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [prefersReducedMotion]);

  // Data Fetching
  const { data, isLoading, error } = useQuery({
    queryKey: ['cloudResources'],
    queryFn: fetchCloudData,
    staleTime: 5 * 60 * 1000, // 5 minutes caching mastery
  });

  // Group data by cluster
  const clusters = useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, item) => {
      if (!acc[item.clusterId]) acc[item.clusterId] = [];
      acc[item.clusterId].push(item);
      return acc;
    }, {} as Record<string, ResourceItem[]>);
  }, [data]);

  if (isLoading) return <div className="atomity-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading telemetry...</div>;
  if (error) return <div className="atomity-container">Error loading telemetry data.</div>;
  if (!data) return null;

  // View data
  const isNamespaceView = selectedCluster !== null;
  const displayData = isNamespaceView ? clusters[selectedCluster] : data;
  
  // Aggregate metrics
  const totalCpu = displayData.reduce((sum, item) => sum + item.cpuUsage, 0);
  const totalMem = Math.round(displayData.reduce((sum, item) => sum + item.memoryUsage, 0));
  const activeNodes = isNamespaceView ? displayData.length : Object.keys(clusters).length;

  const springConfig = { type: 'spring', stiffness: 250, damping: 25 };

  return (
    <section ref={containerRef} className="atomity-container">
      {/* Background Glow tracking cursor */}
      <motion.div 
        className="atomity-glow-blob"
        animate={{
          x: mousePos.x,
          y: mousePos.y,
        }}
        transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
      />
      
      <div className="atomity-content">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <h2 className="atomity-header">Atomity Intelligence</h2>
          <p className="atomity-subheader">
            Deep observability into your cloud spend. Navigate from macro cluster views down to micro pod economics in real-time.
          </p>

          {/* Breadcrumbs */}
          <div className="atomity-breadcrumbs" style={{ height: '32px' }}>
            <span style={{ color: 'var(--atomity-text-primary)', fontWeight: 500 }}>Global Org</span>
            {isNamespaceView && (
              <>
                <span style={{ marginInline: '0.5rem', opacity: 0.5 }}>/</span>
                <button 
                  className="atomity-breadcrumb-btn"
                  onClick={() => setSelectedCluster(null)}
                >
                  Clusters
                </button>
                <span style={{ marginInline: '0.5rem', opacity: 0.5 }}>/</span>
                <span style={{ color: 'var(--atomity-accent-light)' }}>{selectedCluster}</span>
              </>
            )}
          </div>

          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            <MetricCard title="Total Assigned CPU" value={totalCpu} unit="m" />
            <MetricCard title="Total Memory Trajectory" value={totalMem} unit=" MiB" />
            <MetricCard title={isNamespaceView ? "Active Namespaces" : "Monitored Clusters"} value={activeNodes} unit="" />
          </div>

          {/* Animated Bar Chart */}
          <div className="atomity-glass" style={{ marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--atomity-text-secondary)', marginBottom: '1rem', fontWeight: 500 }}>
              {isNamespaceView ? `${selectedCluster} Resource Distribution` : "Cluster Allocation Matrix"}
            </div>
            
            <div className="atomity-bar-chart">
              <AnimatePresence mode="popLayout">
                {!isNamespaceView ? (
                  // Cluster View: Stacked Bars
                  Object.entries(clusters).map(([clusterId, namespaces]) => (
                    <motion.div 
                      key={clusterId}
                      className="atomity-bar-group"
                      onClick={() => setSelectedCluster(clusterId)}
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {namespaces.map((ns) => (
                        <motion.div
                          key={`ns-bar-${ns.namespaceId}`}
                          layoutId={`ns-morph-${ns.namespaceId}`}
                          className="atomity-bar"
                          style={{ height: `${ns.cpuUsage * 0.1}px` }}
                          transition={springConfig}
                        />
                      ))}
                      <div className="atomity-bar-group-label">{clusterId}</div>
                    </motion.div>
                  ))
                ) : (
                  // Namespace View: Exploded Horizontal Bars
                  clusters[selectedCluster].map((ns) => (
                    <motion.div
                      key={`ns-group-${ns.namespaceId}`}
                      className="atomity-bar-group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.div
                        layoutId={`ns-morph-${ns.namespaceId}`}
                        className="atomity-bar"
                        style={{ height: `${ns.cpuUsage * 0.4}px` }} /* scaled up for focus mode */
                        transition={springConfig}
                      />
                      <div className="atomity-bar-group-label">{ns.namespaceId.split('-')[1]}</div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Semantic Table Data */}
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              {isNamespaceView ? "Namespace Telemetry" : "Global Cluster Telemetry"}
            </h3>
            <DataTable 
              data={displayData} 
              onRowClick={(item) => !isNamespaceView && setSelectedCluster(item.clusterId)} 
            />
          </div>

        </motion.div>
      </div>
    </section>
  );
};

export default AtomityIntelligenceEngine;
