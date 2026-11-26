import { ArrowLeft, Printer } from "lucide-react";
import { createPortal } from "react-dom";
import "./PaymentReport.css";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const columns = [["amount", "Моя доля"], ["received", "Из поступлений"], ["remaining", "К получению"]];
const format = value => value == null ? "—" : money.format(value);
const amountTone = (key, value) => {
  if (value == null || key === "amount") return undefined;
  return key === "remaining" && value > 0 ? "due" : "settled";
};

export default function PaymentReport({ rows, author, source, onBack }) {
  const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalReceived = rows.reduce((sum, row) => sum + (row.received ?? 0), 0);
  const percent = totalAmount > 0 && rows.every(row => row.amount != null && row.received != null)
    ? Math.round(totalReceived / totalAmount * 100) + "%" : "—";
  return createPortal(<div className="payment-report" role="dialog" aria-modal="true" aria-label="Отчёт по оплатам">
    <nav className="payment-toolbar" aria-label="Действия с отчётом">
      <div>
        <button type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Назад</button>
        <button type="button" className="payment-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Печать / Сохранить PDF</button>
      </div>
    </nav>
    <article aria-labelledby="payment-report-title">
      <header className="payment-header">
        <div className="payment-brand"><strong>КЛИМАТ-ПРО</strong><time>{date}</time></div>
        <h1 id="payment-report-title">Отчёт по оплатам</h1>
        <p>{author} · {source} · Объектов: {rows.length}</p>
      </header>
      <section className="payment-totals" aria-label="Итоги по оплатам">{columns.map(([key, name]) => {
        const known = rows.filter(row => row[key] != null);
        const total = known.length ? known.reduce((sum, row) => sum + row[key], 0) : null;
        return <div key={key} data-tone={amountTone(key, total)}><small>{name}</small><b>{format(total)}</b></div>;
      })}<div><small>Оплата доли</small><b>{percent}</b></div></section>
      <table><thead><tr><th>Объект</th><th>Стадия и срок</th>{columns.map(([key, name]) => <th key={key}>{name}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.name}</strong><small>{[row.client, row.type, row.executor].filter(Boolean).join(" · ")}</small>{row.reason && <small>{row.reason}</small>}</td>
          <td className="payment-stage">
            <span>{row.stage}</span>{row.deadline && <small>{row.deadline.split("-").reverse().join(".")}</small>}
          </td>
          {columns.map(([key, name]) => <td key={key} data-label={name} data-tone={amountTone(key, row[key])}>{format(row[key])}</td>)}
        </tr>)}</tbody>
      </table>
      <p className="payment-basis">Поступления распределены пропорционально доле в договоре. Остаток рассчитан отдельно по каждому объекту.{rows.some(r => r.reason) && " В итоги включены только известные суммы."}</p>
      {rows.some(row => row.notes) && <section className="payment-notes"><h2>Примечания</h2>{rows.filter(row => row.notes).map(row => <p key={row.id}><b>{row.name}</b> · {row.notes}</p>)}</section>}
    </article>
  </div>, document.body);
}
