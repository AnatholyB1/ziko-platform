import { getTranslations } from 'next-intl/server'
import { PluginShowcaseClient } from './PluginShowcaseClient'

const PLUGIN_IDS = [
  'timer', 'cardio', 'ai-programs', 'rpe', 'stretching',
  'sleep', 'measurements', 'hydration', 'wearables',
  'nutrition', 'supplements',
  'habits', 'persona', 'journal', 'gamification', 'stats',
  'community',
] as const

type PluginId = typeof PLUGIN_IDS[number]

export async function PluginShowcase() {
  const t = await getTranslations('Home')
  const tPlugins = await getTranslations('Plugins')

  const tabs = [
    { key: 'all' as const, label: t('showcase.categoryAll') },
    { key: 'training' as const, label: t('showcase.categoryTraining') },
    { key: 'health' as const, label: t('showcase.categoryHealth') },
    { key: 'nutrition' as const, label: t('showcase.categoryNutrition') },
    { key: 'coaching' as const, label: t('showcase.categoryCoaching') },
    { key: 'community' as const, label: t('showcase.categoryCommunity') },
  ]

  const pluginDescriptions: Record<string, string> = Object.fromEntries(
    PLUGIN_IDS.map((id) => [id, tPlugins(id as PluginId)])
  )

  return (
    <PluginShowcaseClient
      heading={t('showcase.heading')}
      tabs={tabs}
      pluginDescriptions={pluginDescriptions}
    />
  )
}
