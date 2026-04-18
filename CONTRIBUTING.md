# Contributing to @browser-use

We welcome contributions! This document provides guidelines for contributing to the project.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/browser-use.git
   cd browser-use
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

5. **Make your changes**
6. **Run tests**
   ```bash
   npm test
   ```

7. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```

8. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

9. **Create a Pull Request**

## 📋 Development Guidelines

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper generics for reusable components
- Document public APIs with JSDoc comments

### Testing

- Write unit tests for all new features
- Use Jest for testing
- Aim for >80% code coverage
- Test edge cases and error scenarios

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Create examples for new features
- Update CHANGELOG.md for releases

## 🏗️ Project Structure

```
@browser-use/
├── packages/
│   ├── browser-core/           # Core browser and page abstractions
│   ├── tool-definitions/       # Tool definitions for LLM integration
│   ├── agent-integration/      # AI agent integration
│   ├── proxy-support/          # Network proxy support
│   ├── session-recording/      # Recording and replay
│   └── cloud-deployment/       # Cloud utilities
├── examples/                   # Usage examples
├── tests/                      # Test suite
└── docs/                       # Documentation
```

## 🔧 Adding New Features

### Adding a New Tool

1. **Define the tool** in `packages/tool-definitions/src/tools.ts`
   ```typescript
   export const newTool: ToolDefinition = {
     name: 'new_tool',
     description: 'Description of what the tool does',
     parameters: {
       type: 'object',
       properties: {
         param1: {
           type: 'string',
           description: 'Parameter description',
           required: true
         }
       },
       required: ['param1']
     },
     execute: async ({ browser, param1 }) => {
       // Implementation
       return { success: true };
     }
   };
   ```

2. **Add to exports** in `packages/tool-definitions/src/index.ts`

3. **Write tests** in `packages/tool-definitions/src/__tests__/`

4. **Update documentation**

### Adding a New Browser Provider

1. **Create provider file** in `packages/browser-core/src/providers/`

2. **Implement the provider interface**
   ```typescript
   export class CustomProvider implements BrowserProvider {
     async launch(options: LaunchOptions): Promise<Browser> {
       // Implementation
     }
     
     async close(): Promise<void> {
       // Implementation
     }
   }
   ```

3. **Add to browser factory**

4. **Write tests**

## 🐛 Reporting Issues

When reporting issues:

1. **Search existing issues** first
2. **Use the issue template**
3. **Provide reproduction steps**
4. **Include environment details**
   - Node.js version
   - Operating system
   - Browser version
   - Package version

## 📝 Pull Request Process

1. **Update documentation** for any API changes
2. **Add tests** for new functionality
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** with a description of changes
5. **Request review** from at least one maintainer

## 🎯 Coding Standards

### Naming Conventions

- **Classes**: PascalCase (`BrowserAgent`)
- **Interfaces**: PascalCase with descriptive names (`BrowserConfig`)
- **Functions/Methods**: camelCase (`launchBrowser`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Variables**: camelCase (`pageCount`)

### File Structure

- **One class per file** (when practical)
- **Group related functionality**
- **Use index files** for clean exports
- **Keep files under 300 lines**

### Error Handling

- **Always handle errors**
- **Provide meaningful error messages**
- **Use custom error classes** when appropriate
- **Log errors appropriately**

## 🔒 Security

- **Never commit secrets** (API keys, passwords)
- **Validate all inputs**
- **Use parameterized queries** for databases
- **Follow security best practices**

## 📚 Documentation Standards

### JSDoc Comments

```typescript
/**
 * Navigates the browser to a URL
 * @param url - The URL to navigate to
 * @param options - Navigation options
 * @returns Promise that resolves when navigation is complete
 * @example
 * ```typescript
 * await page.goto('https://example.com');
 * ```
 */
async goto(url: string, options?: NavigationOptions): Promise<void> {
  // Implementation
}
```

### README Updates

- **Keep README current** with latest features
- **Include practical examples**
- **Document breaking changes**
- **Provide migration guides** when needed

## 🚀 Release Process

1. **Update version numbers**
   ```bash
   npm version patch  # or minor, major
   ```

2. **Update CHANGELOG.md**

3. **Create release branch**
   ```bash
   git checkout -b release/v1.2.3
   ```

4. **Run full test suite**
   ```bash
   npm test
   npm run build
   ```

5. **Create GitHub release**

6. **Publish to npm**
   ```bash
   npm publish
   ```

## 🤝 Community

- **Join our Discord** for discussions
- **Follow on Twitter** for updates
- **Star on GitHub** to show support

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to @browser-use! 🎉
