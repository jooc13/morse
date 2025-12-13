# Pull Request

## Description

<!-- Briefly describe what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Pre-Deployment Checklist

### Testing

- [ ] All tests pass locally (`just test`)
- [ ] Added tests for new functionality
- [ ] Smoke tests pass (`just smoke`)
- [ ] Health checks pass (`just health`)

### Configuration

- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations added (if applicable)
- [ ] Migration validation passes (`just validate-migrations`)
- [ ] Deployment validation passes (`just validate`)

### Security

- [ ] No secrets committed
- [ ] Dependencies updated (`npm audit` clean)
- [ ] CORS configured correctly
- [ ] Authentication/authorization implemented

### Performance

- [ ] Response times <150ms (p95)
- [ ] No N+1 queries
- [ ] Appropriate caching implemented
- [ ] Database indexes added for new queries

### Documentation

- [ ] Code comments added for complex logic
- [ ] API endpoints documented
- [ ] README updated (if needed)
- [ ] Deployment notes added (if needed)

## Deployment Plan

<!-- How will this be deployed? Any special considerations? -->

- [ ] Can be deployed immediately
- [ ] Requires database migration
- [ ] Requires environment variable changes
- [ ] Requires coordination with other services
- [ ] Breaking change - needs announcement

## Rollback Plan

<!-- How to rollback if this causes issues? -->

- [ ] Standard rollback works (`just rollback`)
- [ ] Database migration is reversible
- [ ] No data loss on rollback
- [ ] Manual steps required: _______________

## Testing Instructions

<!-- How should reviewers test this? -->

1.
2.
3.

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Link related issues -->

Fixes #
Related to #

---

**Reviewer Checklist:**

- [ ] Code follows project conventions
- [ ] Tests are adequate
- [ ] Security concerns addressed
- [ ] Performance impact acceptable
- [ ] Documentation is clear
- [ ] Ready for deployment
