import React from 'react';

interface VerifyEmailCodeProps {
    code: string;
    firstName?: string;
    expiresInMinutes?: number;
}
declare function VerifyEmailCode({ code, firstName, expiresInMinutes, }: VerifyEmailCodeProps): React.ReactElement;

export { VerifyEmailCode, type VerifyEmailCodeProps, VerifyEmailCode as default };
