'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var components = require('@react-email/components');
var jsxRuntime = require('react/jsx-runtime');

// src/templates/ReloginNotice.tsx
var heading = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#1C1A17",
  margin: "0 0 16px 0"
};
var body = { fontSize: "14px", color: "#1C1A17", margin: "0 0 12px 0" };
function ReloginNotice({
  cutoverDateFr,
  cutoverDateEn,
  firstName
}) {
  return /* @__PURE__ */ jsxRuntime.jsxs(components.Html, { lang: "fr", children: [
    /* @__PURE__ */ jsxRuntime.jsx(components.Head, {}),
    /* @__PURE__ */ jsxRuntime.jsx(components.Preview, { children: `Ziko change d'infrastructure le ${cutoverDateFr} : reconnexion n\xE9cessaire` }),
    /* @__PURE__ */ jsxRuntime.jsx(
      components.Body,
      {
        style: {
          backgroundColor: "#F7F6F3",
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          padding: 0
        },
        children: /* @__PURE__ */ jsxRuntime.jsxs(components.Container, { style: { maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }, children: [
          /* @__PURE__ */ jsxRuntime.jsx(components.Section, { style: { padding: "0 0 8px 0" }, children: /* @__PURE__ */ jsxRuntime.jsx(
            components.Text,
            {
              style: {
                fontSize: "28px",
                fontWeight: 600,
                color: "#FF5C1A",
                margin: 0,
                letterSpacing: "-0.5px"
              },
              children: "ZIKO"
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            components.Section,
            {
              style: {
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E0DA",
                borderRadius: "12px",
                padding: "32px"
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsxs(components.Text, { style: heading, children: [
                  "Ziko change d'infrastructure le ",
                  cutoverDateFr
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: firstName ? `Bonjour ${firstName},` : "Bonjour," }),
                /* @__PURE__ */ jsxRuntime.jsxs(components.Text, { style: body, children: [
                  "Le ",
                  cutoverDateFr,
                  ", vous devrez vous reconnecter une fois avec la m\xEAme adresse e-mail et le m\xEAme mot de passe."
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: "Aucune donn\xE9e n'est perdue." }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: "Mettez \xE0 jour l'application mobile depuis le store d\xE8s que la nouvelle version est disponible." }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: "Si la connexion \xE9choue, utilisez \xAB Mot de passe oubli\xE9 \xBB sur l'\xE9cran de connexion." }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Hr, { style: { borderColor: "#E2E0DA", margin: "24px 0" } }),
                /* @__PURE__ */ jsxRuntime.jsxs(components.Text, { style: heading, children: [
                  "Ziko is moving to new infrastructure on ",
                  cutoverDateEn
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: firstName ? `Hello ${firstName},` : "Hello," }),
                /* @__PURE__ */ jsxRuntime.jsxs(components.Text, { style: body, children: [
                  "On ",
                  cutoverDateEn,
                  ", you will need to sign in again once, using the same email and password."
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: "No data is lost." }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: "Please update the mobile app from the store as soon as the new version is available." }),
                /* @__PURE__ */ jsxRuntime.jsx(components.Text, { style: body, children: 'If sign-in fails, use "Forgot password" on the sign-in screen.' })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            components.Text,
            {
              style: {
                fontSize: "12px",
                color: "#6B6963",
                textAlign: "center",
                padding: "16px",
                margin: 0
              },
              children: "Ziko"
            }
          )
        ] })
      }
    )
  ] });
}
var ReloginNotice_default = ReloginNotice;

exports.ReloginNotice = ReloginNotice;
exports.default = ReloginNotice_default;
