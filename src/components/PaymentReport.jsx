import { createPortal } from "react-dom";
import "./PaymentReport.css";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const columns = [["amount", "Моя доля"], ["received", "Из поступлений"], ["remaining", "К получению"]];
const format = value => value == null ? "—" : money.format(value);

export default function PaymentReport({ rows, author, source, onBack }) {
  const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalReceived = rows.reduce((sum, row) => sum + (row.received ?? 0), 0);
  const percent = totalAmount > 0 && rows.every(row => row.amount != null && row.received != null)
    ? Math.round(totalReceived / totalAmount * 100) + "%" : "—";
  return createPortal(<div className="payment-report" role="dialog" aria-label="Отчёт по оплатам">
    <nav><button onClick={onBack}>← Назад</button><button onClick={() => window.print()}>Печать / Сохранить PDF</button></nav>
    <article>
      <header><strong>КЛИМАТ-ПРО</strong><time>{date}</time></header>
      <h1>Отчёт по оплатам</h1><p>{author} · {source} · Объектов: {rows.length}</p>
      <section className="payment-totals">{columns.map(([key, name]) => {
        const known = rows.filter(row => row[key] != null);
        return <div key={key}><small>{name}</small><b>{format(known.length ? known.reduce((sum, row) => sum + row[key], 0) : null)}</b></div>;
      })}<div><small>Оплата доли</small><b>{percent}</b></div></section>
      <table><thead><tr><th>Объект</th><th>Стадия и срок</th>{columns.map(([key, name]) => <th key={key}>{name}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.name}</strong><small>{[row.client, row.type, row.executor].filter(Boolean).join(" · ")}</small>{row.reason && <small>{row.reason}</small>}</td>
          <td>{row.stage}<small>{row.deadline?.split("-").reverse().join(".")}</small></td>
          {columns.map(([key, name]) => <td key={key} data-label={name}>{format(row[key])}</td>)}
        </tr>)}</tbody>
      </table>
      <p className="payment-basis">Поступления распределены пропорционально доле в договоре. Остаток рассчитан отдельно по каждому объекту.{rows.some(r => r.reason) && " В итоги включены только известные суммы."}</p>
      {rows.some(row => row.notes) && <section><h2>Примечания</h2>{rows.filter(row => row.notes).map(row => <p key={row.id}><b>{row.name}</b> · {row.notes}</p>)}</section>}
    </article>
  </div>, document.body);
}
