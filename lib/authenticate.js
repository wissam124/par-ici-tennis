export const createAuthenticatedPage = async (browser, config) => {
  const page = await browser.newPage()
  await page.route('https://captcha.liveidentity.com/captcha/public/frontend/api/v3/captcha-invisible/invisible-captcha-infos', route => route.abort())
  await page.route('https://captcha.liveidentity.com/captcha/public/frontend/api/v3/captchas**', route => route.abort())
  page.setDefaultTimeout(90000)

  const email = config?.account?.email || process.env.ACCOUNT_EMAIL
  const password = config?.account?.password || process.env.ACCOUNT_PASSWORD
  if (!email || !password) {
    throw new Error('Missing Paris Tennis credentials. Configure account.email and account.password, or set ACCOUNT_EMAIL and ACCOUNT_PASSWORD.')
  }

  await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennis&view=start&full=1')
  await page.click('#button_suivi_inscription')
  await page.fill('#username', email)
  await page.fill('#password', password)
  await page.click('#form-login >> button')
  await page.waitForSelector('.main-informations')

  return page
}
