import { Html, Head, Body, Container, Section, Text, Link, Hr, Button } from '@react-email/components';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';

// src/templates/WeeklyDigest.tsx
var SEVERITY_STYLE = {
  high: { backgroundColor: "#FEF2F2", color: "#EF4444" },
  medium: { backgroundColor: "#FFFBEB", color: "#F59E0B" },
  low: { backgroundColor: "#F0FDF4", color: "#16A34A" }
};
var SEVERITY_LABEL = {
  high: "PRIORITE HAUTE",
  medium: "A SURVEILLER",
  low: "A NOTER"
};
function WeeklyDigest({
  coachName,
  weekLabel,
  alertClients,
  okClientNames,
  dashboardUrl
}) {
  const alertCount = alertClients.length;
  return /* @__PURE__ */ jsxs(Html, { lang: "fr", children: [
    /* @__PURE__ */ jsx(Head, {}),
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
                borderRadius: "12px",
                padding: "32px",
                marginBottom: "8px"
              },
              children: [
                /* @__PURE__ */ jsx(
                  Text,
                  {
                    style: {
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1C1A17",
                      margin: "0 0 4px 0"
                    },
                    children: "Votre resume hebdomadaire"
                  }
                ),
                /* @__PURE__ */ jsxs(
                  Text,
                  {
                    style: {
                      fontSize: "12px",
                      color: "#6B6963",
                      margin: "0 0 24px 0"
                    },
                    children: [
                      "Semaine du ",
                      weekLabel
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(Text, { style: { fontSize: "14px", color: "#1C1A17", margin: "0 0 4px 0" }, children: [
                  "Bonjour ",
                  coachName,
                  ","
                ] }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: "14px", color: "#1C1A17", margin: "0 0 24px 0" }, children: "Voici les points cles de vos clients cette semaine." }),
                alertClients.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsxs(
                    Text,
                    {
                      style: {
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1C1A17",
                        margin: "0 0 12px 0",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      },
                      children: [
                        alertCount,
                        " client",
                        alertCount > 1 ? "s" : "",
                        " a surveiller"
                      ]
                    }
                  ),
                  alertClients.map((client) => /* @__PURE__ */ jsxs(
                    Section,
                    {
                      style: {
                        backgroundColor: "#F7F6F3",
                        borderRadius: "8px",
                        padding: "16px",
                        marginBottom: "8px"
                      },
                      children: [
                        /* @__PURE__ */ jsx(
                          Text,
                          {
                            style: {
                              ...SEVERITY_STYLE[client.severity],
                              fontSize: "11px",
                              fontWeight: 600,
                              margin: "0 0 6px 0",
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "4px"
                            },
                            children: SEVERITY_LABEL[client.severity]
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          Text,
                          {
                            style: {
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#1C1A17",
                              margin: "0 0 4px 0"
                            },
                            children: client.name
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          Text,
                          {
                            style: {
                              fontSize: "13px",
                              color: "#6B6963",
                              margin: "0 0 8px 0"
                            },
                            children: client.summary
                          }
                        ),
                        /* @__PURE__ */ jsxs(
                          Link,
                          {
                            href: `${dashboardUrl}?client=${client.clientId}`,
                            style: {
                              fontSize: "13px",
                              color: "#FF5C1A",
                              textDecoration: "none",
                              fontWeight: 500
                            },
                            children: [
                              "Analyser ",
                              client.name,
                              " \u2192"
                            ]
                          }
                        )
                      ]
                    },
                    client.clientId
                  ))
                ] }),
                okClientNames.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsxs(
                    Text,
                    {
                      style: {
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1C1A17",
                        margin: alertClients.length > 0 ? "16px 0 8px 0" : "0 0 8px 0",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      },
                      children: [
                        okClientNames.length,
                        " client",
                        okClientNames.length > 1 ? "s" : "",
                        " en bonne forme"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Section,
                    {
                      style: {
                        backgroundColor: "#F0FDF4",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        marginBottom: "8px"
                      },
                      children: /* @__PURE__ */ jsxs(Text, { style: { fontSize: "13px", color: "#6B6963", margin: 0 }, children: [
                        okClientNames.join(", "),
                        " \u2014 RAS"
                      ] })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx(Hr, { style: { borderColor: "#E2E0DA", margin: "24px 0" } }),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    href: dashboardUrl,
                    style: {
                      backgroundColor: "#FF5C1A",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: 600,
                      padding: "8px 24px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      display: "inline-block"
                    },
                    children: "Ouvrir le tableau de bord \u2192"
                  }
                )
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
              children: "Cet email est genere automatiquement par Ziko IA."
            }
          )
        ] })
      }
    )
  ] });
}

export { WeeklyDigest };
