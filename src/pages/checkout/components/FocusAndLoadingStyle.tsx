export const FocusAndLoadingStyle = () => (
  <style>{`
    .checkout .btn:focus,
    .checkout .btn:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 .25rem rgba(var(--duu-green-rgb), .30) !important;
      border-color: var(--dz-green) !important;
    }
    .checkout .btn-duu:focus,
    .checkout .btn-duu:focus-visible {
      box-shadow: 0 0 0 .3rem rgba(var(--duu-green-rgb), .30) !important;
    }
    .btn[aria-busy="true"] { pointer-events: none; opacity: .9; }
    .btn .visually-hidden {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    .addr-pill{
      display:inline-flex;
      align-items:center;
      gap:.5rem;
      padding:.35rem .6rem;
      border-radius:999px;
      border:1px solid var(--dz-line);
      background:var(--dz-surface);
      font-weight:700;
      color:var(--dz-ink);
      max-width:100%;
    }
    .addr-pill small{
      font-weight:600;
      color:var(--dz-ink-muted);
    }

    .btn-duu{
      background: var(--dz-green);
      color: #fff;
      border: none;
      border-radius: 999px;
    }
    .btn-duu:hover{ filter: brightness(1.08); color: #fff; }

    .seg { display:flex; gap:.5rem; flex-wrap:wrap; }
    .seg .btn{ border-radius:999px !important; }
    .mini-note{ font-size:.92rem; color: var(--dz-ink-muted); }
    .rib-box{
      border:1px dashed var(--dz-line);
      border-radius: var(--dz-radius-sm);
      padding:.75rem;
      background:var(--dz-surface);
    }

    .gps-box{
      border:1px dashed var(--dz-line);
      border-radius: var(--dz-radius-sm);
      padding:.75rem;
      background:var(--dz-surface-2);
    }
  `}</style>
);
