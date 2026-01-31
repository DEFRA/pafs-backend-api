import { describe, it, expect } from 'vitest'
import {
  hasAccessToArea,
  hasAccessToParentPso,
  canCreateProject,
  canUpdateProject
} from './project-permissions.js'

describe('project-permissions', () => {
  describe('hasAccessToArea', () => {
    it('should return true when user has access to the area', () => {
      const userAreas = [
        { areaId: '1', primary: true },
        { areaId: '2', primary: false }
      ]

      expect(hasAccessToArea(userAreas, '1')).toBe(true)
      expect(hasAccessToArea(userAreas, '2')).toBe(true)
    })

    it('should return false when user does not have access to the area', () => {
      const userAreas = [{ areaId: '1', primary: true }]

      expect(hasAccessToArea(userAreas, '3')).toBe(false)
    })

    it('should handle numeric and string area IDs', () => {
      const userAreas = [{ areaId: 1, primary: true }]

      expect(hasAccessToArea(userAreas, '1')).toBe(true)
      expect(hasAccessToArea(userAreas, 1)).toBe(true)
    })

    it('should return false for empty user areas', () => {
      expect(hasAccessToArea([], '1')).toBe(false)
    })

    it('should return false for null user areas', () => {
      expect(hasAccessToArea(null, '1')).toBe(false)
    })

    it('should return false for undefined user areas', () => {
      expect(hasAccessToArea(undefined, '1')).toBe(false)
    })
  })

  describe('hasAccessToParentPso', () => {
    it('should return true when user has access to parent PSO', () => {
      const userAreas = [{ areaId: '10', primary: true }]
      const areaWithParents = {
        id: 5,
        area_type: 'RMA',
        PSO: {
          id: 10,
          area_type: 'PSO Area',
          sub_type: 'RFCC1'
        }
      }

      expect(hasAccessToParentPso(userAreas, areaWithParents)).toBe(true)
    })

    it('should return false when user does not have access to parent PSO', () => {
      const userAreas = [{ areaId: '5', primary: true }]
      const areaWithParents = {
        id: 5,
        area_type: 'RMA',
        PSO: {
          id: 10,
          area_type: 'PSO Area'
        }
      }

      expect(hasAccessToParentPso(userAreas, areaWithParents)).toBe(false)
    })

    it('should return false when PSO parent is missing', () => {
      const userAreas = [{ areaId: '5', primary: true }]
      const areaWithParents = {
        id: 5,
        area_type: 'RMA'
      }

      expect(hasAccessToParentPso(userAreas, areaWithParents)).toBe(false)
    })

    it('should return false when PSO id is missing', () => {
      const userAreas = [{ areaId: '5', primary: true }]
      const areaWithParents = {
        id: 5,
        area_type: 'RMA',
        PSO: {
          area_type: 'PSO Area'
        }
      }

      expect(hasAccessToParentPso(userAreas, areaWithParents)).toBe(false)
    })

    it('should return false when areaWithParents is null', () => {
      const userAreas = [{ areaId: '5', primary: true }]

      expect(hasAccessToParentPso(userAreas, null)).toBe(false)
    })
  })

  describe('canCreateProject', () => {
    it('should allow RMA user with area access to create project', () => {
      const credentials = {
        isRma: true,
        areas: [{ areaId: '5', primary: true }]
      }

      const result = canCreateProject(credentials, '5')

      expect(result.allowed).toBe(true)
    })

    it('should deny non-RMA user from creating project', () => {
      const credentials = {
        isRma: false,
        isPso: true,
        areas: [{ areaId: '5', primary: true }]
      }

      const result = canCreateProject(credentials, '5')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Only RMA users')
    })

    it('should deny RMA user without area access from creating project', () => {
      const credentials = {
        isRma: true,
        areas: [{ areaId: '3', primary: true }]
      }

      const result = canCreateProject(credentials, '5')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain(
        'do not have access to the specified area'
      )
    })

    it('should deny RMA user with no areas from creating project', () => {
      const credentials = {
        isRma: true,
        areas: []
      }

      const result = canCreateProject(credentials, '5')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('do not have access')
    })
  })

  describe('canUpdateProject', () => {
    it('should allow admin to update any project', () => {
      const credentials = {
        isAdmin: true,
        areas: []
      }
      const projectAreaDetails = {
        id: 5,
        area_type: 'RMA'
      }

      const result = canUpdateProject(credentials, projectAreaDetails)

      expect(result.allowed).toBe(true)
    })

    it('should allow user with project area access to update', () => {
      const credentials = {
        isAdmin: false,
        areas: [{ areaId: '5', primary: true }]
      }
      const projectAreaDetails = {
        id: 5,
        area_type: 'RMA'
      }

      const result = canUpdateProject(credentials, projectAreaDetails)

      expect(result.allowed).toBe(true)
    })

    it('should allow user with parent PSO access to update', () => {
      const credentials = {
        isAdmin: false,
        areas: [{ areaId: '10', primary: true }]
      }
      const projectAreaDetails = {
        id: 5,
        area_type: 'RMA',
        PSO: {
          id: 10,
          area_type: 'PSO Area'
        }
      }

      const result = canUpdateProject(credentials, projectAreaDetails)

      expect(result.allowed).toBe(true)
    })

    it('should deny user without project or PSO access', () => {
      const credentials = {
        isAdmin: false,
        areas: [{ areaId: '8', primary: true }]
      }
      const projectAreaDetails = {
        id: 5,
        area_type: 'RMA',
        PSO: {
          id: 10,
          area_type: 'PSO Area'
        }
      }

      const result = canUpdateProject(credentials, projectAreaDetails)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('do not have permission')
    })

    it('should deny update when project area details are missing', () => {
      const credentials = {
        isAdmin: false,
        areas: [{ areaId: '5', primary: true }]
      }

      const result = canUpdateProject(credentials, null)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('area information not found')
    })

    it('should deny user with empty areas array', () => {
      const credentials = {
        isAdmin: false,
        areas: []
      }
      const projectAreaDetails = {
        id: 5,
        area_type: 'RMA'
      }

      const result = canUpdateProject(credentials, projectAreaDetails)

      expect(result.allowed).toBe(false)
    })
  })

  describe('permission rules integration', () => {
    it('should enforce complete create workflow', () => {
      // RMA user with area access
      const rmaUser = {
        isRma: true,
        areas: [{ areaId: '5', primary: true }]
      }
      expect(canCreateProject(rmaUser, '5').allowed).toBe(true)

      // PSO user cannot create
      const psoUser = {
        isRma: false,
        isPso: true,
        areas: [{ areaId: '5', primary: true }]
      }
      expect(canCreateProject(psoUser, '5').allowed).toBe(false)

      // RMA user without area access
      const rmaUserNoAccess = {
        isRma: true,
        areas: [{ areaId: '10', primary: true }]
      }
      expect(canCreateProject(rmaUserNoAccess, '5').allowed).toBe(false)
    })

    it('should enforce complete update workflow', () => {
      const projectArea = {
        id: 5,
        area_type: 'RMA',
        PSO: { id: 10, area_type: 'PSO Area' }
      }

      // Admin can update
      expect(
        canUpdateProject({ isAdmin: true, areas: [] }, projectArea).allowed
      ).toBe(true)

      // RMA user with project area access
      expect(
        canUpdateProject(
          { isAdmin: false, areas: [{ areaId: '5', primary: true }] },
          projectArea
        ).allowed
      ).toBe(true)

      // User with PSO access
      expect(
        canUpdateProject(
          { isAdmin: false, areas: [{ areaId: '10', primary: true }] },
          projectArea
        ).allowed
      ).toBe(true)

      // User without access
      expect(
        canUpdateProject(
          { isAdmin: false, areas: [{ areaId: '99', primary: true }] },
          projectArea
        ).allowed
      ).toBe(false)
    })
  })
})
