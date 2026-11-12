import React from 'react';
import RewardsRoute from '../../../../src/components/RewardsRoute';

// D-15 : la boutique est absorbee dans l'onglet Boutique ; la route reste pour les liens existants.
export default function ShopScreenRoute() {
  return <RewardsRoute initialTab="Boutique" />;
}
