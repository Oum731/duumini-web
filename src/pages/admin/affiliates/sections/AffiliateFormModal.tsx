import type { RefObject } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import { DUU, cardStyle } from "../shared";
import { SectionTitle } from "../components";
import { safeUserLabel, normalizeAffiliateCodeLocal, slugify } from "../helpers";
import type { Affiliate, AffiliateFormData, AffiliateStatus, UserOption } from "../types";

export function AffiliateFormModal({
  editingItem,
  form,
  submitting,
  userSearch,
  userResults,
  usersLoading,
  selectedUser,
  showUserDropdown,
  userDropdownRef,
  onClose,
  onSubmit,
  onUserSearchChange,
  onUserSearchFocus,
  onSelectUser,
  onClearUser,
  onPatchForm,
  onNameBlur,
}: {
  editingItem: Affiliate | null;
  form: AffiliateFormData;
  submitting: boolean;
  userSearch: string;
  userResults: UserOption[];
  usersLoading: boolean;
  selectedUser: UserOption | null;
  showUserDropdown: boolean;
  userDropdownRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onUserSearchChange: (value: string) => void;
  onUserSearchFocus: () => void;
  onSelectUser: (user: UserOption) => void;
  onClearUser: () => void;
  onPatchForm: <K extends keyof AffiliateFormData>(key: K, value: AffiliateFormData[K]) => void;
  onNameBlur: (name: string) => void;
}) {
  return (
    <div className="p-3 p-lg-4 mb-4" style={cardStyle()}>
      <SectionTitle
        icon={<Plus size={20} />}
        title={editingItem ? "Modifier un affilié" : "Créer un affilié"}
        sub="Recherche d’utilisateur, auto-remplissage et configuration de l’affilié"
        right={
          <button
            type="button"
            className="btn"
            style={{
              background: DUU.white,
              color: DUU.black,
              border: `1px solid ${DUU.line}`,
              borderRadius: 14,
              fontWeight: 700,
            }}
            onClick={onClose}
          >
            Fermer
          </button>
        }
      />

      <form onSubmit={onSubmit}>
        <div className="row g-4">
          <div className="col-12">
            <div
              className="p-3 p-lg-4"
              style={{
                borderRadius: 20,
                background: DUU.yellowSoft,
                border: `1px solid ${DUU.yellowBorder}`,
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <Users size={18} />
                <div className="fw-bold" style={{ color: DUU.black }}>
                  Lier un utilisateur existant
                </div>
              </div>

              <div className="small mb-3" style={{ color: "#6B5B22" }}>
                Recherche par nom, prénom, téléphone ou user_id. La sélection remplit
                automatiquement les champs et crée le code affilié depuis le nom du user.
              </div>

              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-7">
                  <label className="form-label fw-semibold">Recherche utilisateur</label>

                  <div className="position-relative" ref={userDropdownRef}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: DUU.gray,
                        zIndex: 2,
                      }}
                    />

                    <input
                      type="text"
                      className="form-control"
                      style={{
                        paddingLeft: 40,
                        borderRadius: 16,
                        borderColor: DUU.yellowBorder,
                        minHeight: 48,
                        background: DUU.white,
                      }}
                      value={userSearch}
                      onChange={(e) => onUserSearchChange(e.target.value)}
                      onFocus={onUserSearchFocus}
                      placeholder="Ex: Oumar, +2126..., 15..."
                    />

                    {showUserDropdown && (usersLoading || userResults.length > 0) ? (
                      <div
                        className="position-absolute start-0 end-0 mt-2"
                        style={{
                          zIndex: 20,
                          maxHeight: 260,
                          overflowY: "auto",
                          borderRadius: 16,
                          background: DUU.white,
                          border: `1px solid ${DUU.yellowBorder}`,
                          boxShadow: "0 14px 30px rgba(17,17,17,0.10)",
                        }}
                      >
                        {usersLoading ? (
                          <div className="px-3 py-3 small" style={{ color: DUU.gray }}>
                            Recherche en cours...
                          </div>
                        ) : (
                          userResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="btn w-100 text-start border-0 rounded-0"
                              style={{
                                background: "transparent",
                                color: DUU.black,
                                padding: "12px 14px",
                              }}
                              onClick={() => onSelectUser(user)}
                            >
                              <div className="fw-semibold">{safeUserLabel(user)}</div>
                              <div className="small" style={{ color: DUU.gray }}>
                                ID: {user.id}
                                {user.phone ? ` • ${user.phone}` : ""}
                                {user.email ? ` • ${user.email}` : ""}
                                {user.role ? ` • ${user.role}` : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  {selectedUser ? (
                    <div
                      className="d-flex align-items-center justify-content-between gap-3 p-3"
                      style={{
                        borderRadius: 16,
                        background: DUU.white,
                        border: `1px solid ${DUU.yellowBorder}`,
                      }}
                    >
                      <div>
                        <div className="fw-semibold" style={{ color: DUU.black }}>
                          {safeUserLabel(selectedUser)}
                        </div>
                        <div className="small" style={{ color: DUU.gray }}>
                          ID: {selectedUser.id}
                          {selectedUser.phone ? ` • ${selectedUser.phone}` : ""}
                          {selectedUser.role ? ` • ${selectedUser.role}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          borderRadius: 12,
                          background: DUU.white,
                          border: `1px solid ${DUU.line}`,
                          color: DUU.black,
                        }}
                        onClick={onClearUser}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="small px-3 py-3"
                      style={{
                        borderRadius: 16,
                        background: DUU.white,
                        border: `1px dashed ${DUU.yellowBorder}`,
                        color: DUU.gray,
                      }}
                    >
                      Aucun utilisateur sélectionné
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Nom</label>
            <input
              type="text"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.name}
              onChange={(e) => onPatchForm("name", e.target.value)}
              onBlur={(e) => onNameBlur(e.target.value)}
              required
            />
          </div>

          <div className="col-12 col-md-6 col-lg-2">
            <label className="form-label fw-semibold">User ID</label>
            <input
              type="number"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.user_id}
              onChange={(e) => onPatchForm("user_id", e.target.value)}
              placeholder="Optionnel"
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label className="form-label fw-semibold">Code affilié</label>
            <input
              type="text"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.affiliate_code}
              onChange={(e) =>
                onPatchForm("affiliate_code", normalizeAffiliateCodeLocal(e.target.value))
              }
              required
            />
          </div>

          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Slug</label>
            <input
              type="text"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.referral_slug}
              onChange={(e) => onPatchForm("referral_slug", slugify(e.target.value))}
              placeholder="Optionnel"
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold">Téléphone</label>
            <input
              type="text"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.phone}
              onChange={(e) => onPatchForm("phone", e.target.value)}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold">Commission %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.commission_rate}
              onChange={(e) => onPatchForm("commission_rate", e.target.value)}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold">Statut</label>
            <select
              className="form-select"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={form.status}
              onChange={(e) => onPatchForm("status", e.target.value as AffiliateStatus)}
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </select>
          </div>

          <div className="col-12">
            <label className="form-label fw-semibold">Notes</label>
            <textarea
              className="form-control"
              rows={3}
              style={{ borderRadius: 16, borderColor: DUU.line }}
              value={form.notes}
              onChange={(e) => onPatchForm("notes", e.target.value)}
            />
          </div>

          <div className="col-12 d-flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              className="btn"
              style={{
                background: DUU.yellow,
                color: DUU.black,
                borderRadius: 16,
                fontWeight: 800,
                minHeight: 46,
                paddingInline: 18,
              }}
              disabled={submitting}
            >
              {submitting
                ? "Enregistrement..."
                : editingItem
                  ? "Mettre à jour"
                  : "Créer l'affilié"}
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: DUU.white,
                color: DUU.black,
                border: `1px solid ${DUU.line}`,
                borderRadius: 16,
                fontWeight: 700,
                minHeight: 46,
                paddingInline: 18,
              }}
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
