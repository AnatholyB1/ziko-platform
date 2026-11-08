import { Html, Head, Preview, Body, Container, Section, Text } from '@react-email/components';
import { jsxs, jsx } from 'react/jsx-runtime';

// src/templates/VerifyEmailCode.tsx
var body = { fontSize: "14px", color: "#1C1A17", margin: "0 0 12px 0" };
function VerifyEmailCode({
  code,
  firstName,
  expiresInMinutes = 10
}) {
  return /* @__PURE__ */ jsxs(Html, { lang: "fr", children: [
    /* @__PURE__ */ jsx(Head, {}),
    /* @__PURE__ */ jsx(Preview, { children: `Ton code de confirmation Ziko : ${code}` }),
    /* @__PURE__ */ jsx(
      Body,
      {
        style: {
          backgroundColor: "#F7F6F3",
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          padding: 0
        },
        children: /* @__PURE__ */ jsxs(Container, { style: { maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }, children: [
          /* @__PURE__ */ jsx(Section, { style: { padding: "0 0 8px 0" }, children: /* @__PURE__ */ jsx(
            Text,
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
          /* @__PURE__ */ jsxs(
            Section,
            {
              style: {
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E0DA",
                borderRadius: "12px",
                padding: "32px"
              },
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: "18px", fontWeight: 600, color: "#1C1A17", margin: "0 0 16px 0" }, children: "Confirme ton adresse email" }),
                /* @__PURE__ */ jsx(Text, { style: body, children: firstName ? `Bonjour ${firstName},` : "Bonjour," }),
                /* @__PURE__ */ jsx(Text, { style: body, children: "Saisis ce code dans l'application Ziko pour confirmer ton adresse :" }),
                /* @__PURE__ */ jsx(
                  Text,
                  {
                    style: {
                      fontSize: "32px",
                      fontWeight: 700,
                      letterSpacing: "8px",
                      color: "#1C1A17",
                      backgroundColor: "#F7F6F3",
                      border: "1px solid #E2E0DA",
                      borderRadius: "12px",
                      textAlign: "center",
                      padding: "16px",
                      margin: "8px 0 16px 0"
                    },
                    children: code
                  }
                ),
                /* @__PURE__ */ jsxs(Text, { style: body, children: [
                  "Ce code expire dans ",
                  expiresInMinutes,
                  " minutes."
                ] }),
                /* @__PURE__ */ jsx(Text, { style: { ...body, color: "#6B6963" }, children: "Si tu n'es pas \xE0 l'origine de cette demande, ignore simplement cet email." })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            Text,
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
var VerifyEmailCode_default = VerifyEmailCode;

export { VerifyEmailCode, VerifyEmailCode_default as default };
