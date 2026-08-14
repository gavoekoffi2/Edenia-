import QRCode from "qrcode";

/**
 * QR code rendu en SVG inline.
 *
 * Pas d'appel a une API de generation d'images : envoyer l'URI otpauth d'un
 * administrateur — donc son secret TOTP — a un service tiers reviendrait a lui
 * confier le second facteur du back-office.
 *
 * Le SVG est aussi le bon format ici : quelques centaines d'octets, net a
 * toutes les tailles, et aucune requete supplementaire depuis le navigateur.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: { dark: "#1a1310", light: "#ffffff" },
  });
}
