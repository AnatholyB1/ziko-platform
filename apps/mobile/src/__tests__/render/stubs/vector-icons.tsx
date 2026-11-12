import React from 'react';

export const Ionicons: any = ({ name }: { name: string }) =>
  React.createElement('i', { 'data-icon': name });
Ionicons.glyphMap = {};
export default { Ionicons };
