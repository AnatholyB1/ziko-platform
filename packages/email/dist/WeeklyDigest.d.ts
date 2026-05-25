import React from 'react';

interface AlertClient {
    name: string;
    severity: 'high' | 'medium' | 'low';
    summary: string;
    clientId: string;
}
interface WeeklyDigestProps {
    coachName: string;
    weekLabel: string;
    alertClients: AlertClient[];
    okClientNames: string[];
    dashboardUrl: string;
}
declare function WeeklyDigest({ coachName, weekLabel, alertClients, okClientNames, dashboardUrl, }: WeeklyDigestProps): React.ReactElement;

export { type AlertClient, WeeklyDigest, type WeeklyDigestProps };
