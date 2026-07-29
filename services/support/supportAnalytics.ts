type SupportAnalyticsEvent = 'support_opened' | 'support_issue_category_selected' | 'support_channel_selected' | 'whatsapp_support_launched' | 'support_launch_failed'

// Deliberately no-op until BitBridge selects a production analytics provider.
// Keep payloads category-only: no messages, contact details, or financial context.
export const trackSupportEvent = (event: SupportAnalyticsEvent, payload: { category?: string; reason?: string } = {}) => {
  void event
  void payload
}

export type { SupportAnalyticsEvent }
