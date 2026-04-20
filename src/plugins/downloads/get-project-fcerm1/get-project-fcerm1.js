import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectFcerm1Service } from '../services/project-fcerm1-service.js'
import { FcermPresenter } from '../helpers/fcerm1/fcerm1-presenter.js'
import { buildSingleWorkbook } from '../helpers/fcerm1/fcerm1-builder.js'
import {
  FCERM1_YEARS,
  LEGACY_COLUMNS
} from '../helpers/fcerm1/fcerm1-legacy-columns.js'
import {
  NEW_FCERM1_YEARS,
  NEW_COLUMNS
} from '../helpers/fcerm1/fcerm1-new-columns.js'
import { resolveAreaHierarchy } from '../../projects/helpers/area-hierarchy.js'

const directoryName = fileURLToPath(new URL('.', import.meta.url))

// Both templates live alongside the column + presenter helpers.
const TEMPLATES_DIR = join(directoryName, '..', 'helpers', 'fcerm1')

export const LEGACY_TEMPLATE_PATH = join(TEMPLATES_DIR, 'fcerm1_template.xlsx')
export const NEW_TEMPLATE_PATH = join(TEMPLATES_DIR, 'fcerm1_new_template.xlsx')

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function createFcerm1Route({ format, templatePath, columns, years }) {
  return {
    method: 'GET',
    path: `/api/v1/project/{referenceNumber}/fcerm1/${format}`,
    options: {
      auth: 'jwt',
      description: `Download the ${format} FCERM1 Excel spreadsheet for a project`,
      notes: `Generates the ${format} FCERM1 template on demand and streams it as an XLSX download`,
      tags: ['api', 'downloads', 'fcerm1']
    },
    handler: async (request, h) => {
      if (columns.length === 0) {
        return h
          .response({
            error: `FCERM1 ${format} format is not yet available`
          })
          .code(HTTP_STATUS.NOT_IMPLEMENTED)
      }

      try {
        const referenceNumber = request.params.referenceNumber.replaceAll(
          '-',
          '/'
        )

        const service = new ProjectFcerm1Service(
          request.prisma,
          request.server.logger
        )
        const data = await service.getProjectForFcerm1(referenceNumber)

        if (!data) {
          return h
            .response({ error: 'Project not found' })
            .code(HTTP_STATUS.NOT_FOUND)
        }

        const { project, contributors, areaId } = data
        const areaHierarchy = await resolveAreaHierarchy(request.prisma, areaId)
        const presenter = new FcermPresenter(
          project,
          areaHierarchy,
          contributors
        )

        const buffer = await buildSingleWorkbook(
          templatePath,
          presenter,
          columns,
          years
        )

        const filename = `${referenceNumber.replaceAll('/', '-')}_proposal.xlsx`

        return h
          .response(buffer)
          .code(HTTP_STATUS.OK)
          .header('Content-Type', XLSX_CONTENT_TYPE)
          .header('Content-Disposition', `attachment; filename="${filename}"`)
      } catch (error) {
        request.server.logger.error(
          { error },
          `Failed to generate FCERM1 ${format} download`
        )
        return h
          .response({ error: 'Failed to generate FCERM1 download' })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

/** GET /api/v1/project/{referenceNumber}/fcerm1/legacy */
export const getProjectFcerm1Legacy = createFcerm1Route({
  format: 'legacy',
  templatePath: LEGACY_TEMPLATE_PATH,
  columns: LEGACY_COLUMNS,
  years: FCERM1_YEARS
})

/** GET /api/v1/project/{referenceNumber}/fcerm1/new */
export const getProjectFcerm1New = createFcerm1Route({
  format: 'new',
  templatePath: NEW_TEMPLATE_PATH,
  columns: NEW_COLUMNS,
  years: NEW_FCERM1_YEARS
})

export default getProjectFcerm1Legacy
