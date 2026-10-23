import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="navbar navbar-expand-lg bg-white rounded-4 mt-3 px-3 shadow-sm">
      <span className="navbar-brand fw-bold">📦 Inventory Management</span>
      <ul className="navbar-nav ms-auto flex-row gap-3">
        <li className="nav-item">
          <NavLink end className="nav-link" to="/">Dashboard</NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/new">Add Product</NavLink>
        </li>
      </ul>
    </nav>
  );
}
