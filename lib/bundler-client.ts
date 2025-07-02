export interface BundlerResponse {
  jsonrpc: string
  id: number
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export class BundlerClient {
  private url: string
  private apiKey?: string

  constructor(url: string, apiKey?: string) {
    this.url = url
    this.apiKey = apiKey
  }

  private async makeRequest(method: string, params: any[]): Promise<BundlerResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async sendUserOperation(userOp: any, entryPoint: string): Promise<string> {
    const response = await this.makeRequest("eth_sendUserOperation", [userOp, entryPoint])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return response.result
  }

  async getUserOperationReceipt(userOpHash: string): Promise<any> {
    const response = await this.makeRequest("eth_getUserOperationReceipt", [userOpHash])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return response.result
  }

  async getUserOperationByHash(userOpHash: string): Promise<any> {
    const response = await this.makeRequest("eth_getUserOperationByHash", [userOpHash])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return response.result
  }

  async estimateUserOperationGas(userOp: any, entryPoint: string): Promise<any> {
    const response = await this.makeRequest("eth_estimateUserOperationGas", [userOp, entryPoint])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return response.result
  }

  async getSupportedEntryPoints(): Promise<string[]> {
    const response = await this.makeRequest("eth_supportedEntryPoints", [])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return response.result
  }

  async getChainId(): Promise<number> {
    const response = await this.makeRequest("eth_chainId", [])

    if (response.error) {
      throw new Error(`Bundler error: ${response.error.message}`)
    }

    return Number.parseInt(response.result, 16)
  }
}
