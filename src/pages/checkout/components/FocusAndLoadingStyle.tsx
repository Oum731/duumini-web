export const FocusAndLoadingStyle = () => (
  <style>{`
    .checkout .btn:focus,
    .checkout .btn:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 .25rem rgba(229, 57, 53, .35) !important;
      border-color: #E53935 !important;
    }
    .checkout .btn-duu:focus,
    .checkout .btn-duu:focus-visible {
      box-shadow: 0 0 0 .3rem rgba(229, 57, 53, .35) !important;
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
      border:1px solid rgba(0,0,0,.08);
      background:rgba(255,255,255,.7);
      font-weight:700;
      color:#111;
      max-width:100%;
    }
    .addr-pill small{
      font-weight:600;
      color:rgba(0,0,0,.62);
    }

    .btn-duu{
      background: var(--duu-yellow);
      color: #1f1f1f;
      border: none;
    }
    .btn-duu:hover{ filter: brightness(0.95); }

    .seg { display:flex; gap:.5rem; flex-wrap:wrap; }
    .seg .btn{ border-radius:999px !important; }
    .mini-note{ font-size:.92rem; color:rgba(0,0,0,.65); }
    .rib-box{
      border:1px dashed rgba(0,0,0,.2);
      border-radius:12px;
      padding:.75rem;
      background:rgba(255,255,255,.6);
    }

    .gps-box{
      border:1px dashed rgba(0,0,0,.16);
      border-radius:12px;
      padding:.75rem;
      background:#fffdf4;
    }
  `}</style>
);
