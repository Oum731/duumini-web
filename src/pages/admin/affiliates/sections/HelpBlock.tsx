import { ChevronRight } from "lucide-react";
import { DUU, cardStyle } from "../shared";
import { SectionTitle } from "../components";

export function HelpBlock() {
  return (
    <div className="mt-4 p-3 p-lg-4" style={cardStyle()}>
      <SectionTitle
        icon={<ChevronRight size={20} />}
        title="Lecture métier"
        sub="Ce que ce dashboard te montre concrètement"
      />

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div
            className="p-3 h-100"
            style={{
              borderRadius: 18,
              background: DUU.yellowSoft,
              border: `1px solid ${DUU.yellowBorder}`,
            }}
          >
            <div className="fw-bold mb-2" style={{ color: DUU.black }}>
              Acquisition
            </div>
            <div className="small" style={{ color: "#5B5B5B" }}>
              Les clics trackés permettent de voir quels affiliés apportent du trafic
              réel via les liens code, slug, site et produit.
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div
            className="p-3 h-100"
            style={{
              borderRadius: 18,
              background: DUU.white,
              border: `1px solid ${DUU.line}`,
            }}
          >
            <div className="fw-bold mb-2" style={{ color: DUU.black }}>
              Conversion
            </div>
            <div className="small" style={{ color: "#5B5B5B" }}>
              Les commandes et commissions montrent quels affiliés convertissent
              réellement le trafic en ventes. Le code affilié reste transporté dans
              le parcours client grâce aux liens avec <code>ref</code>.
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div
            className="p-3 h-100"
            style={{
              borderRadius: 18,
              background: DUU.white,
              border: `1px solid ${DUU.line}`,
            }}
          >
            <div className="fw-bold mb-2" style={{ color: DUU.black }}>
              Historique
            </div>
            <div className="small" style={{ color: "#5B5B5B" }}>
              Les rapports jour, semaine, mois et année permettent à chaque affilié
              de vérifier ses gains passés et à l’admin de suivre le revenu global
              du réseau.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
