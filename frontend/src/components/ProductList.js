import React, { useContext, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import ProductTableRow from './ProductTableRow';
import { ProductContext } from '../context/ProductContext';
import { getProducts } from '../services/ApiService';

export default function ProductList() {
  const { products, updateProducts } = useContext(ProductContext);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [low, setLow] = useState(20);

  useEffect(() => {
    async function fetchData() {
      try {
        updateProducts(await getProducts());
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    }
    fetchData();
    // eslint-disable-next-line
  }, []);

  const stats = useMemo(() => {
    const units = products.reduce((s, p) => s + (p.quantity || 0), 0);
    const value = products.reduce((s, p) => s + (p.price || 0) * (p.quantity || 0), 0);
    const lowList = products.filter(p => p.quantity < low);
    const max = Math.max(1, ...products.map(p => p.quantity || 0));
    const lowPct = products.length ? Math.round((lowList.length / products.length) * 100) : 0;
    return { units, value, lowList, max, lowPct };
  }, [products, low]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => (p.title || '').toLowerCase().includes(q))
      .sort((a, b) => sortBy === 'title'
        ? (a.title || '').localeCompare(b.title || '')
        : (a[sortBy] || 0) - (b[sortBy] || 0));
  }, [products, search, sortBy]);

  function exportCsv() {
    const lines = ['id,title,price,quantity', ...rows.map(p =>
      [p.id, `"${String(p.title).replace(/"/g, '""')}"`, p.price, p.quantity].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const n = products.length;
  const curve = products.map((p, i) => {
    const x = n > 1 ? (i / (n - 1)) * 100 : 50;
    const y = 36 - ((p.quantity || 0) / stats.max) * 30;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="pb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center my-4 gap-2">
        <div>
          <h3 className="mb-0 fw-bold">Overview</h3>
          <small className="text-muted">Detailed information about your inventory</small>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select rounded-pill" value={low} onChange={e => setLow(Number(e.target.value))}>
            <option value={10}>Low stock below 10</option>
            <option value={20}>Low stock below 20</option>
            <option value={50}>Low stock below 50</option>
          </select>
          <button className="btn btn-dark rounded-pill px-4" onClick={exportCsv}>Export</button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-3 col-md-6">
          <div className="d-card h-100">
            <div className="d-label">Inventory Value</div>
            <div className="d-big">{Math.round(stats.value).toLocaleString()}</div>
            <small className="text-muted">Price x quantity of all products</small>
            <div className="d-bars mt-3">
              {products.slice(0, 12).map(p => (
                <div key={p.id} className="d-bar" title={`${p.title}: ${p.quantity}`}
                     style={{ height: `${Math.max(8, ((p.quantity || 0) / stats.max) * 100)}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6">
          <div className="d-card h-100">
            <div className="d-label">Total Units</div>
            <div className="d-big">{stats.units.toLocaleString()}</div>
            <small className="text-muted">{n} products in stock list</small>
            <div className="d-split mt-3">
              <div style={{ flex: Math.max(100 - stats.lowPct, 1), background: '#7c4dff' }}>{100 - stats.lowPct}%</div>
              {stats.lowPct > 0 && <div style={{ flex: stats.lowPct, background: '#f472d0' }}>{stats.lowPct}%</div>}
            </div>
            <div className="d-legend mt-2">
              <span><i style={{ background: '#7c4dff' }} /> Healthy</span>
              <span><i style={{ background: '#f472d0' }} /> Low stock</span>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6">
          <div className="d-card h-100">
            <div className="d-label">Total Products</div>
            <div className="d-big">{n}</div>
            <small className="text-muted">{stats.lowList.length} need restocking</small>
            <svg className="d-curve mt-3" viewBox="0 0 100 40" preserveAspectRatio="none">
              {n > 0 && <polygon points={`0,40 ${curve} 100,40`} fill="#7c4dff" opacity="0.15" />}
              {n > 0 && <polyline points={curve} fill="none" stroke="#7c4dff" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
            </svg>
          </div>
        </div>

        <div className="col-lg-3 col-md-6">
          <div className="d-card h-100">
            <div className="d-flex justify-content-between">
              <div className="d-label">Low stock alerts</div>
              <a href="#all-products" className="small text-dark">See all</a>
            </div>
            {stats.lowList.length === 0 && <p className="text-muted small mt-3">All products are above the limit.</p>}
            {stats.lowList.slice(0, 3).map(p => (
              <div key={p.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                <span className="d-avatar">{(p.title || '?').charAt(0).toUpperCase()}</span>
                <div className="flex-grow-1">
                  <div className="fw-semibold small">{p.title}</div>
                  <small className="text-muted">Only {p.quantity} left</small>
                </div>
                <NavLink to={`/${p.id}/edit`} className="small text-dark">Restock</NavLink>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4">
          <div className="d-card h-100">
            <div className="d-flex justify-content-between mb-3">
              <div className="fw-semibold">Stock by product</div>
              <a href="#all-products" className="small text-dark">See all</a>
            </div>
            {products.slice(0, 6).map(p => (
              <div key={p.id} className="mb-3">
                <div className="d-flex justify-content-between small">
                  <span>{p.title}</span><span>{p.quantity}</span>
                </div>
                <div className="d-track"><div style={{ width: `${((p.quantity || 0) / stats.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-8">
          <div className="d-card h-100">
            <div className="d-flex justify-content-between mb-3">
              <div className="fw-semibold">Stock analytics</div>
              <div className="d-legend">
                <span><i style={{ background: '#7c4dff' }} /> Healthy</span>
                <span><i style={{ background: '#f472d0' }} /> Low stock</span>
              </div>
            </div>
            <div className="d-chart">
              {products.map(p => (
                <div key={p.id} className="d-col">
                  <div className="d-colbar" title={`${p.title}: ${p.quantity}`}
                       style={{ height: `${Math.max(3, ((p.quantity || 0) / stats.max) * 100)}%`,
                                background: p.quantity < low ? '#f472d0' : '#7c4dff' }} />
                  <small className="d-collabel">{p.title}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="d-card mt-3" id="all-products">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="fw-semibold">All products</div>
          <div className="d-flex gap-2">
            <input className="form-control rounded-pill" placeholder="Search products"
                   value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-select rounded-pill" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="id">Sort: Newest</option>
              <option value="title">Sort: Title A-Z</option>
              <option value="price">Sort: Price</option>
              <option value="quantity">Sort: Stock (low first)</option>
            </select>
            <NavLink className="btn btn-primary rounded-pill text-nowrap px-3" to="/new">+ Add</NavLink>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Item</th><th>Price</th><th>Stock</th><th>Status</th><th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => <ProductTableRow key={p.id} {...p} low={low} />)}
              {rows.length === 0 && (
                <tr><td colSpan="5" className="text-center text-muted py-4">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
