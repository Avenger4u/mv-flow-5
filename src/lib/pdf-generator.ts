interface Order {
  id: string;
  order_number: string;
  order_date: string;
  subtotal: number;
  raw_material_deductions: number;
  net_total: number;
  parties: { name: string; address: string | null } | null;
}

interface OrderItem {
  serial_no: number;
  particular: string;
  quantity: number;
  quantity_unit: string;
  rate_per_dzn: number;
  total: number;
}

interface Deduction {
  material_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export async function generateOrderPDF(
  order: Order,
  items: OrderItem[],
  deductions: Deduction[]
): Promise<void> {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Packing List - ${order.order_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #D97706;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          color: #D97706;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .header h2 {
          font-size: 20px;
          margin-top: 15px;
          color: #333;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background: #f9f5f0;
          border-radius: 8px;
        }
        .info-item label {
          font-size: 12px;
          color: #666;
          display: block;
        }
        .info-item span {
          font-size: 14px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 13px;
        }
        td {
          font-size: 14px;
        }
        .text-right {
          text-align: right;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin: 25px 0 15px;
          color: #333;
        }
        .totals {
          margin-top: 30px;
          padding: 20px;
          background: #f9f5f0;
          border-radius: 8px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
        }
        .totals-row.final {
          border-top: 2px solid #D97706;
          margin-top: 10px;
          padding-top: 15px;
          font-size: 18px;
          font-weight: bold;
        }
        .totals-row.final span:last-child {
          color: #D97706;
        }
        .deduction {
          color: #dc2626;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Mystic Vastra</h1>
        <p>Madhuvan Enclave, Krishna Nagar, Mathura</p>
        <h2>Packing List</h2>
      </div>

      <div class="info-row">
        <div class="info-item">
          <label>Party Name</label>
          <span>${order.parties?.name || 'Unknown'}</span>
        </div>
        <div class="info-item">
          <label>Order No.</label>
          <span>${order.order_number}</span>
        </div>
        <div class="info-item">
          <label>Date</label>
          <span>${formatDate(order.order_date)}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Particular</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate per Dzn</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr>
              <td>${item.serial_no}</td>
              <td>${item.particular}</td>
              <td class="text-right">${item.quantity} ${item.quantity_unit}</td>
              <td class="text-right">${formatCurrency(item.rate_per_dzn)}</td>
              <td class="text-right">${formatCurrency(item.total)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      ${
        deductions.length > 0
          ? `
        <div class="section-title">Raw Material Received</div>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${deductions
              .map(
                (d) => `
              <tr>
                <td>${d.material_name}</td>
                <td class="text-right">${d.quantity}</td>
                <td class="text-right">${formatCurrency(d.rate)}</td>
                <td class="text-right deduction">-${formatCurrency(d.amount)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }

      <div class="totals">
        <div class="totals-row">
          <span>Sub Total:</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
        ${
          order.raw_material_deductions > 0
            ? `
          <div class="totals-row deduction">
            <span>Raw Material Deductions:</span>
            <span>-${formatCurrency(order.raw_material_deductions)}</span>
          </div>
        `
            : ''
        }
        <div class="totals-row final">
          <span>Net Total:</span>
          <span>${formatCurrency(order.net_total)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
