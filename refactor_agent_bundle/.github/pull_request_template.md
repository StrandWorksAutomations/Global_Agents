### Summary
- What changed, why, and expected impact.

### Risk & Rollback
- Risk level: low / medium / high
- Rollback: `git revert <sha>` or disable feature flag

### Validation
- [ ] Unit tests pass (coverage ≥ threshold)
- [ ] Type checks pass
- [ ] Lint/format pass
- [ ] Security scans pass
- [ ] For SQL changes: EXPLAIN shows improved plan

### Compliance (if HIPAA set)
- [ ] Access control paths unchanged or hardened
- [ ] Logs redact PHI; encryption verified in transit/at rest
