# 🤖 AI Development Rules for Morvarid Statistics Management System

## 📋 Project Overview
This is **Morvarid Integrated Statistics System** - a Persian PWA for poultry farm management with enterprise-grade security, offline capabilities, and role-based access control.

---

## 🎯 Core Development Principles

### 1. 🔐 Security-First Approach
- **NEVER** expose sensitive data in logs or error messages
- **ALWAYS** validate environment variables before usage
- **MANDATORY** sanitize user inputs and database queries
- Use the existing security middleware and enterprise-security.ts patterns
- Follow RLS (Row Level Security) patterns for database access
- Encrypt sensitive data using existing crypto utilities

### 2. 🌍 Internationalization & RTL Support
- **PRIMARY LANGUAGE**: Persian (فارسی)
- **TEXT DIRECTION**: RTL (Right-to-Left)
- Use Persian text for UI elements and error messages
- Implement proper Jalali (Persian) date handling
- Support Persian number input and formatting
- Follow existing i18n patterns in components

### 3. 📱 PWA & Offline-First Design
- **ALWAYS** consider offline functionality
- Use existing offline sync patterns (`useOfflineSync`)
- Implement optimistic UI updates for better UX
- Cache critical data in IndexedDB
- Follow PWA best practices for mobile experience

---

## 🏗️ Architecture Guidelines

### File Organization
```
src/
├── components/           # Reusable UI components
│   ├── admin/           # Admin-specific components
│   ├── auth/            # Authentication components  
│   ├── common/          # Shared components
│   └── layout/          # Layout components
├── hooks/               # Custom React hooks
├── lib/                 # External library configs
├── middleware/          # Security & API middleware
├── pages/               # Main application pages
├── security/            # Enterprise security modules
├── services/            # Business logic services
├── store/               # Zustand state management
├── types/               # TypeScript type definitions
└── utils/               # Helper functions
```

### State Management
- **USE**: Zustand for global state
- **PATTERN**: Individual stores for different domains (authStore, farmStore, etc.)
- **AVOID**: Prop drilling - use stores for shared state
- **PERSIST**: Use existing persistence patterns for offline support

### Component Patterns
- **PREFER**: Function components with hooks
- **USE**: TypeScript interfaces from `src/types.ts`
- **FOLLOW**: Metro UI design patterns
- **IMPLEMENT**: Framer Motion for animations
- **TEST**: Write tests in `__tests__` directories

---

## 🎨 UI/UX Standards

### Design System
- **THEME**: Metro UI with dual light/dark themes
- **COLORS**: Role-based color schemes (Admin: Purple, Registration: Orange, Sales: Blue)
- **COMPONENTS**: Use existing common components (Button, Input, Modal, etc.)
- **RESPONSIVE**: Mobile-first approach with Tailwind CSS
- **ANIMATIONS**: Use Framer Motion for smooth transitions

### User Roles & Permissions
```typescript
enum UserRole {
  ADMIN = 'ADMIN',           // Full system access
  REGISTRATION = 'REGISTRATION', // Data entry & statistics
  SALES = 'SALES'            // Sales dashboard & reports
}
```

### Accessibility
- **RTL**: Proper right-to-left layout support
- **CONTRAST**: Ensure proper color contrast ratios
- **KEYBOARD**: Full keyboard navigation support
- **SCREEN READERS**: Proper ARIA labels and semantic HTML

---

## 💾 Database & API Patterns

### Supabase Integration
- **CLIENT**: Use the configured singleton client from `src/lib/supabase.ts`
- **RLS**: Always respect Row Level Security policies
- **TYPES**: Generate and use proper TypeScript types
- **ERROR HANDLING**: Sanitize errors before logging
- **REALTIME**: Use Supabase realtime for live updates

### Data Models
- **USERS**: Role-based access with farm assignments
- **FARMS**: Support for different farm types (MORVARIDI, MOTEFEREGHE)
- **INVOICES**: Daily production records with validation
- **STATISTICS**: Daily farm statistics with aggregation
- **AUDIT**: Track all user actions for compliance

---

## 🔧 Development Workflow

### Environment Setup
1. **REQUIRED**: Copy `.env.example` to `.env`
2. **VALIDATE**: Run `npm run predev` to check environment
3. **SECURITY**: Never commit `.env` files
4. **KEYS**: Use proper encryption keys (256-bit minimum)

### Code Quality
- **LINTING**: Follow ESLint rules (see `.eslintrc.cjs`)
- **TESTING**: Write tests for critical functionality
- **TYPES**: Use strict TypeScript configuration
- **FORMATTING**: Consistent code formatting
- **COMMENTS**: Document complex business logic

### Version Control
- **VERSIONING**: Follow Semantic Versioning (SemVer)
- **BRANCHES**: Use feature branches for new development
- **COMMITS**: Write clear, descriptive commit messages
- **REVIEWS**: Peer review for security-critical changes

---

## 🚨 Security Requirements

### Authentication & Authorization
- **MFA**: Multi-factor authentication support
- **SESSION**: Secure session management with timeout
- **BIOMETRIC**: Device-based biometric authentication
- **RATE LIMITING**: Prevent brute force attacks
- **AUDIT**: Log all authentication events

### Data Protection
- **ENCRYPTION**: Encrypt sensitive data at rest and in transit
- **SANITIZATION**: Sanitize all user inputs
- **VALIDATION**: Server-side and client-side validation
- **BACKUP**: Secure database backup procedures
- **GDPR**: Data privacy compliance

### Error Handling
```typescript
// ✅ GOOD: Sanitized error logging
console.error('[Operation] ❌ Database error:', { 
  message: 'Operation failed', 
  details: 'Error details sanitized for security' 
});

// ❌ BAD: Exposing internal details
console.error('Database error:', error.message);
```

---

## 📊 Performance Guidelines

### Optimization
- **LAZY LOADING**: Code splitting for route components
- **MEMOIZATION**: Use React.memo and useMemo appropriately
- **VIRTUALIZATION**: For large data lists
- **CACHING**: Implement proper caching strategies
- **COMPRESSION**: Enable gzip compression for production

### Monitoring
- **LOGGING**: Use structured logging with LogService
- **METRICS**: Track performance metrics
- **ERRORS**: Monitor and alert on errors
- **USAGE**: Track user interaction patterns

---

## 🧪 Testing Strategy

### Test Types
- **UNIT**: Individual functions and components
- **INTEGRATION**: Component interactions
- **E2E**: Critical user flows
- **SECURITY**: Security vulnerability testing
- **PERFORMANCE**: Load and stress testing

### Test Patterns
```typescript
// Component testing
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

test('renders button with correct text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

---

## 🚀 Deployment Guidelines

### Environment Configuration
- **DEVELOPMENT**: Local development with hot reload
- **STAGING**: Production-like environment for testing
- **PRODUCTION**: Live environment with monitoring

### CI/CD Pipeline
- **BUILD**: Automated builds on every commit
- **TEST**: Run full test suite before deployment
- **SECURITY**: Security scanning for vulnerabilities
- **DEPLOY**: Automated deployment to staging/production

### Monitoring & Maintenance
- **UPTIME**: Monitor application availability
- **PERFORMANCE**: Track response times and errors
- **SECURITY**: Regular security updates and patches
- **BACKUP**: Automated database backups

---

## 📝 Documentation Standards

### Code Documentation
- **FUNCTIONS**: JSDoc comments for complex functions
- **INTERFACES**: Document TypeScript interfaces
- **COMPONENTS**: Props and usage examples
- **APIS**: Document API endpoints and responses

### User Documentation
- **GUIDES**: Installation and setup guides
- **MANUALS**: User manuals for different roles
- **TROUBLESHOOTING**: Common issues and solutions
- **API**: Developer API documentation

---

## ⚠️ Common Pitfalls to Avoid

1. **Security Issues**
   - Exposing sensitive data in logs
   - Missing input validation
   - Improper error handling
   - Weak authentication

2. **Performance Problems**
   - Memory leaks in React components
   - Unnecessary re-renders
   - Large bundle sizes
   - Inefficient database queries

3. **UX Issues**
   - Poor offline experience
   - Slow loading times
   - Inconsistent UI patterns
   - Missing accessibility features

4. **Data Issues**
   - Race conditions in state updates
   - Inconsistent data validation
   - Poor error recovery
   - Data loss in offline mode

---

## 🎯 Success Metrics

### Technical Metrics
- **PERFORMANCE**: < 2s initial load time
- **RELIABILITY**: > 99.9% uptime
- **SECURITY**: Zero critical vulnerabilities
- **QUALITY**: > 90% test coverage

### Business Metrics
- **ADOPTION**: User engagement and retention
- **EFFICIENCY**: Time saved in daily operations
- **ACCURACY**: Data entry error reduction
- **SATISFACTION**: User feedback scores

---

*This document should be updated as the project evolves and new patterns emerge.*