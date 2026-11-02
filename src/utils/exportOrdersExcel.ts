// src/utils/exportOrdersExcel.ts
import * as XLSX from "xlsx";
import type { Order } from "../services/orders";
import {
  computeOrderAmounts,
  getPaymentFromOrder,
  getOrderDisplayCode,
} from "../components/ordersAdmin/orderUtils";

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR");
}

function buildOrderExportRow(order: Order) {
  const { itemsAmount, shippingFee, total, duuShare, vendorNet } = computeOrderAmounts(order);
  const payment = getPaymentFromOrder(order);
  const contact = order.contact || {};
  const city = contact.ville || contact.city || contact.commune || "";

  return {
    "N° commande": getOrderDisplayCode(order),
    Date: formatDateTime(order.created_at),
    Statut: order.status,
    Client: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
    Téléphone: contact.phone || "",
    Ville: city,
    Adresse: contact.address_line || "",
    "Statut paiement": payment.status || "",
    "Montant payé (MAD)": payment.paid_amount,
    "Reste à payer (MAD)": payment.remaining_amount ?? "",
    "Produits (MAD)": itemsAmount,
    "Livraison (MAD)": shippingFee,
    "Total (MAD)": total,
    "Commission Duumini (MAD)": duuShare,
    "Net vendeur (MAD)": vendorNet,
    "Code affilié": order.affiliate_code || "",
  };
}

export function exportOrdersToExcel(orders: Order[], filenamePrefix = "duumini-commandes") {
  const rows = orders.map(buildOrderExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 12 }, // N° commande
    { wch: 18 }, // Date
    { wch: 12 }, // Statut
    { wch: 22 }, // Client
    { wch: 14 }, // Téléphone
    { wch: 14 }, // Ville
    { wch: 28 }, // Adresse
    { wch: 14 }, // Statut paiement
    { wch: 16 }, // Montant payé
    { wch: 16 }, // Reste à payer
    { wch: 14 }, // Produits
    { wch: 14 }, // Livraison
    { wch: 14 }, // Total
    { wch: 18 }, // Commission Duumini
    { wch: 14 }, // Net vendeur
    { wch: 14 }, // Code affilié
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${today}.xlsx`);
}
