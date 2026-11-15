// P25 (MCOA-02) : plugins obligatoires (non desinstallables). Source unique cote mobile :
// PluginLoader (chargement inconditionnel) ET le store (garde de desinstallation) l'utilisent.
// Garde serveur correspondante : migration 20261201250300 (lit `manifest.mandatory` du registre).

export const MANDATORY_PLUGIN_IDS: string[] = ['coach'];

type WithMandatory = { mandatory?: boolean } | null | undefined;

/** Obligatoire si la liste statique OU le manifeste (registre ou local) le declare. */
export function isMandatoryPlugin(pluginId: string, manifest?: WithMandatory): boolean {
  return MANDATORY_PLUGIN_IDS.includes(pluginId) || manifest?.mandatory === true;
}

export const MANDATORY_ALERT_TITLE = 'Module obligatoire';
export const MANDATORY_ALERT_MESSAGE = 'Mon coach fait partie de Ziko et ne peut pas être désinstallé.';

export type UninstallDecision = { allowed: true } | { allowed: false; title: string; message: string };

export function uninstallDecision(pluginId: string, manifest?: WithMandatory): UninstallDecision {
  if (isMandatoryPlugin(pluginId, manifest)) {
    return { allowed: false, title: MANDATORY_ALERT_TITLE, message: MANDATORY_ALERT_MESSAGE };
  }
  return { allowed: true };
}
