import React from 'react';

interface ReloginNoticeProps {
    cutoverDateFr: string;
    cutoverDateEn: string;
    firstName?: string;
}
declare function ReloginNotice({ cutoverDateFr, cutoverDateEn, firstName, }: ReloginNoticeProps): React.ReactElement;

export { ReloginNotice, type ReloginNoticeProps, ReloginNotice as default };
