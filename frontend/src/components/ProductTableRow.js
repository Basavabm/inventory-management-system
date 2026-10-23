import { NavLink } from "react-router-dom";
import { deleteProductById } from "../services/ApiService";
import { useContext } from 'react';
import { ProductContext } from "../context/ProductContext";

export default function ProductTableRow({ id, title, price, quantity, low }) {

  const { removeProductById } = useContext(ProductContext);

  async function deleteProduct() {
    try {
      await deleteProductById(id);
      removeProductById(id);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }

  const isLow = quantity < low;

  return (
    <tr>
      <td>
        <div className="d-flex align-items-center gap-2">
          <span className="d-avatar">{(title || '?').charAt(0).toUpperCase()}</span>
          <div>
            <div className="fw-semibold">{title}</div>
            <small className="text-muted">ID {id}</small>
          </div>
        </div>
      </td>
      <td>{Number(price).toLocaleString()}</td>
      <td>{quantity}</td>
      <td>
        <span className={`d-pill ${isLow ? 'd-pill-low' : 'd-pill-ok'}`}>
          {isLow ? 'Low stock' : 'In stock'}
        </span>
      </td>
      <td className="text-end">
        <NavLink className="btn btn-sm btn-light me-1" to={`/${id}`}>View</NavLink>
        <NavLink className="btn btn-sm btn-light me-1" to={`/${id}/edit`}>Edit</NavLink>
        <button onClick={deleteProduct} className="btn btn-sm btn-dark">Delete</button>
      </td>
    </tr>
  );
}
