import '../styles/globals.css'
import 'katex/dist/katex.min.css'
import WebsiteAssistant from '../components/WebsiteAssistant'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <WebsiteAssistant />
    </>
  )
}

export default MyApp 