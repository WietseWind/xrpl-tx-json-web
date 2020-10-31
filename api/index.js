const {TxData} = require('xrpl-txdata')
const txd = new TxData()
const {RateLimiterMemory} = require('rate-limiter-flexible')
const RateLimitOptions = {
  points: 10, // points
  duration: 60, // per interval (second)
}
const rateLimiter = new RateLimiterMemory(RateLimitOptions)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    if (!req.query.tx) {
      throw new Error('No TX in route')
    }
    if (!req.query.tx.match(/^[A-F0-9a-f]{64}$/)) {
      throw new Error('Invalid TX hash (not 64 HEX chars)')
    }

    const rateLimiterRes = await rateLimiter.consume(req.headers['x-real-ip'], 1)

    res.setHeader('Retry-After', rateLimiterRes.msBeforeNext / 1000)
    res.setHeader('X-RateLimit-Limit', RateLimitOptions.points)
    res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints)
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext))

    if (typeof req.query.format === 'string' && req.query.format === 'json') {
      res.setHeader('Content-Type', 'application/json; Charset=UTF-8')
      res.json(await txd.get(req.query.tx.toUpperCase().trim()))
    } else {
      res.setHeader('Content-Type', 'text/plain; Charset=UTF-8')
      res.send(JSON.stringify(await txd.get(req.query.tx.toUpperCase().trim()), null, 2))
    }
  } catch (error) {
    if (typeof error.remainingPoints !== 'undefined' && error.remainingPoints === 0) {
      const message = `Rate limit exceeded: ${RateLimitOptions.points} requests in ${RateLimitOptions.duration} sec.`
      return res.status(403).json({ error: message })
    } else {
      return res.status(404).json({ error: error.message })
    }
  }
}
