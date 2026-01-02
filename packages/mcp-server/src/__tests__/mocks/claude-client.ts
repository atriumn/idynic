/**
 * Mock Claude client for testing MCP tool integration
 *
 * This module simulates Claude's behavior when calling MCP tools,
 * allowing us to test tool execution flows without a real Claude instance.
 */

import { executeTool, tools } from '../../tools.js'
import type { IdynicClient } from '../../client.js'

// Tool call types (simulating Claude's tool use)
export interface ToolCall {
  id: string
  name: string
  arguments: unknown
}

export interface ToolResult {
  tool_call_id: string
  content: string
  success: boolean
  error?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'tool_result'
  content: string
  tool_calls?: ToolCall[]
  tool_results?: ToolResult[]
}

export interface ConversationTurn {
  userMessage: string
  assistantResponse: {
    content: string
    toolCalls: ToolCall[]
    toolResults: ToolResult[]
  }
}

/**
 * Mock Claude client that simulates MCP tool calling behavior
 */
export class MockClaudeClient {
  private client: IdynicClient
  private conversationHistory: Message[] = []
  private toolCallCounter = 0

  constructor(idynicClient: IdynicClient) {
    this.client = idynicClient
  }

  /**
   * Get available tools in Claude's expected format
   */
  getTools(): Array<{
    name: string
    description: string
    input_schema: unknown
  }> {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }))
  }

  /**
   * Simulate Claude deciding which tool to call based on user message
   * This is a simplified simulation - real Claude uses NLP
   */
  private inferToolCall(userMessage: string): ToolCall | null {
    const message = userMessage.toLowerCase()

    // Simple keyword-based tool inference
    if (message.includes('profile') && !message.includes('update') && !message.includes('tailored')) {
      return this.createToolCall('get_profile', {})
    }

    if (message.includes('update') && message.includes('profile')) {
      // Extract potential updates from message
      const nameMatch = message.match(/name[:\s]+([^\n,]+)/i)
      const emailMatch = message.match(/email[:\s]+([^\s,]+)/i)
      return this.createToolCall('update_profile', {
        ...(nameMatch && { name: nameMatch[1].trim() }),
        ...(emailMatch && { email: emailMatch[1].trim() }),
      })
    }

    if (message.includes('claims') || message.includes('skills') || message.includes('achievements')) {
      return this.createToolCall('get_claims', {})
    }

    if (message.includes('opportunities') || message.includes('jobs')) {
      if (message.includes('add') || message.includes('new')) {
        const urlMatch = message.match(/https?:\/\/[^\s]+/i)
        // Look for a substantial description
        const descMatch = message.match(/description[:\s]+(.{50,})/i)
        return this.createToolCall('add_opportunity', {
          ...(urlMatch && { url: urlMatch[0] }),
          description: descMatch ? descMatch[1] : 'A'.repeat(50), // Minimum 50 chars required
        })
      }
      if (message.includes('applied')) {
        return this.createToolCall('list_opportunities', { status: 'applied' })
      }
      if (message.includes('tracking')) {
        return this.createToolCall('list_opportunities', { status: 'tracking' })
      }
      return this.createToolCall('list_opportunities', {})
    }

    if (message.includes('match') || message.includes('analysis')) {
      const idMatch = message.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      if (idMatch) {
        return this.createToolCall('analyze_match', { id: idMatch[1] })
      }
    }

    if (message.includes('tailored') || message.includes('resume')) {
      const idMatch = message.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      if (idMatch) {
        return this.createToolCall('get_tailored_profile', { id: idMatch[1] })
      }
    }

    if (message.includes('share') || message.includes('link')) {
      const idMatch = message.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      if (idMatch) {
        return this.createToolCall('create_share_link', { id: idMatch[1] })
      }
    }

    return null
  }

  private createToolCall(name: string, args: unknown): ToolCall {
    this.toolCallCounter++
    return {
      id: `call_${this.toolCallCounter}`,
      name,
      arguments: args,
    }
  }

  /**
   * Execute a tool call and return the result
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    try {
      const result = await executeTool(this.client, toolCall.name, toolCall.arguments)
      const content = result.content[0]?.text || 'No content'

      return {
        tool_call_id: toolCall.id,
        content,
        success: !content.startsWith('Error'),
        ...(content.startsWith('Error') && { error: content }),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        tool_call_id: toolCall.id,
        content: `Error: ${message}`,
        success: false,
        error: message,
      }
    }
  }

  /**
   * Simulate a complete chat turn with tool use
   */
  async chat(userMessage: string): Promise<ConversationTurn> {
    // Store user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    })

    // Infer which tool to call
    const toolCall = this.inferToolCall(userMessage)
    const toolCalls: ToolCall[] = toolCall ? [toolCall] : []
    const toolResults: ToolResult[] = []

    // Execute tool calls
    for (const call of toolCalls) {
      const result = await this.executeToolCall(call)
      toolResults.push(result)
    }

    // Generate assistant response
    let assistantContent: string
    if (toolResults.length > 0) {
      const successfulResults = toolResults.filter((r) => r.success)
      const failedResults = toolResults.filter((r) => !r.success)

      if (failedResults.length > 0) {
        assistantContent = `I encountered an error: ${failedResults[0].error}`
      } else {
        assistantContent = `Here's what I found:\n${successfulResults.map((r) => r.content).join('\n')}`
      }
    } else {
      assistantContent = "I'm not sure how to help with that. Could you be more specific?"
    }

    // Store assistant message
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantContent,
      tool_calls: toolCalls,
    })

    if (toolResults.length > 0) {
      this.conversationHistory.push({
        role: 'tool_result',
        content: '',
        tool_results: toolResults,
      })
    }

    return {
      userMessage,
      assistantResponse: {
        content: assistantContent,
        toolCalls,
        toolResults,
      },
    }
  }

  /**
   * Execute a specific tool directly (bypassing inference)
   */
  async executeTool(name: string, args: unknown): Promise<ToolResult> {
    const toolCall = this.createToolCall(name, args)
    return this.executeToolCall(toolCall)
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory]
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
  }

  /**
   * Simulate multi-turn conversation
   */
  async multiTurnConversation(messages: string[]): Promise<ConversationTurn[]> {
    const turns: ConversationTurn[] = []
    for (const message of messages) {
      const turn = await this.chat(message)
      turns.push(turn)
    }
    return turns
  }
}

/**
 * Create a mock Claude client for testing
 */
export function createMockClaudeClient(idynicClient: IdynicClient): MockClaudeClient {
  return new MockClaudeClient(idynicClient)
}

/**
 * Helper to verify tool was called with expected arguments
 */
export function expectToolCalled(
  turns: ConversationTurn[],
  toolName: string,
  expectedArgs?: unknown
): void {
  const allToolCalls = turns.flatMap((t) => t.assistantResponse.toolCalls)
  const matchingCalls = allToolCalls.filter((c) => c.name === toolName)

  if (matchingCalls.length === 0) {
    throw new Error(`Expected tool "${toolName}" to be called, but it was not.`)
  }

  if (expectedArgs !== undefined) {
    const hasMatchingArgs = matchingCalls.some(
      (c) => JSON.stringify(c.arguments) === JSON.stringify(expectedArgs)
    )
    if (!hasMatchingArgs) {
      throw new Error(
        `Expected tool "${toolName}" to be called with ${JSON.stringify(expectedArgs)}, ` +
          `but was called with ${JSON.stringify(matchingCalls[0].arguments)}`
      )
    }
  }
}

/**
 * Helper to verify tool result was successful
 */
export function expectToolSuccess(turns: ConversationTurn[], toolName: string): void {
  const allResults = turns.flatMap((t) => t.assistantResponse.toolResults)
  const toolCalls = turns.flatMap((t) => t.assistantResponse.toolCalls)

  const toolCallIds = toolCalls.filter((c) => c.name === toolName).map((c) => c.id)
  const matchingResults = allResults.filter((r) => toolCallIds.includes(r.tool_call_id))

  if (matchingResults.length === 0) {
    throw new Error(`No results found for tool "${toolName}"`)
  }

  const failedResults = matchingResults.filter((r) => !r.success)
  if (failedResults.length > 0) {
    throw new Error(`Tool "${toolName}" failed: ${failedResults[0].error}`)
  }
}
