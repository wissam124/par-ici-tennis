export const notify = async (file, filename, message, config) => {
  try {
    const response = await fetch(`https://${config.domain || 'ntfy.sh'}/${config.topic}`, {
      method: 'PUT',
      headers: {
        'Title': 'Paris Tennis',
        'Message': message,
        'Icon': 'https://em-content.zobj.net/source/apple/419/tennis_1f3be.png',
        'Filename': filename,
        'Tags': 'calendar',
      },
      body: file,
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      throw new Error(`ntfy returned HTTP ${response.status}.`)
    }
    console.log('Notification sent via ntfy')

    return true
  } catch (err) {
    console.error('Error while sending notification using ntfy:', err.message)

    return false
  }
}
