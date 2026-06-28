export function scrollToInsightChat() {
  requestAnimationFrame(() => {
    document.getElementById('insight-chat')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}
