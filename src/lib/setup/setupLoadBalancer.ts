import { addBackendSetup } from '@/cli/sub/add/addBackendSetup'
import {
  addBackend,
  addPathMatcher,
  createBackend,
  createCaaRecords,
  createFixIp,
  createFr,
  createLb,
  createNeg,
  createProxy,
  createRecord,
  createSecurityPolicy,
  createSsl,
  createZone,
  updateBackend,
  getIp,
  setGcloudProject,
  getNetworkConfig,
  Logger,
  getFunctionInfo,
  importConfig,
  SKEET_CONFIG_PATH,
} from '@/lib'
import { SkeetCloudConfig } from '@/types/skeetTypes'
import { writeFileSync } from 'fs'

export const setupLoadBalancer = async (
  config: SkeetCloudConfig,
  lbDomain: string,
  nsDomain: string
) => {
  try {
    await setGcloudProject(config.app.projectId)
    const networkConf = await getNetworkConfig(
      config.app.projectId,
      config.app.name
    )
    await createFixIp(
      config.app.projectId,
      config.app.region,
      networkConf.loadBalancerIpName,
      true
    )
    const methodName = 'root'
    await createNeg(config.app.projectId, methodName, config.app.region, true)
    const defaultBackendServiceName = `${config.app.name}-default`
    await createBackend(config.app.projectId, defaultBackendServiceName)
    await addBackend(
      config.app.projectId,
      config.app.name,
      defaultBackendServiceName,
      config.app.region,
      true
    )

    await createLb(config.app.projectId, config.app.name)
    await createSsl(config.app.projectId, config.app.name, lbDomain)
    await createProxy(config.app.projectId, config.app.name)
    await createFr(config.app.projectId, config.app.name)

    await createSecurityPolicy(config.app.projectId, config.app.name)
    await updateBackend(
      config.app.projectId,
      config.app.name,
      defaultBackendServiceName
    )

    const paths = []

    // Create GraphQL Endpoint if template includes graphql
    if (config.app.template.includes('GraphQL')) {
      const graphqlInfo = await getFunctionInfo('graphql')
      await addBackendSetup('graphql')
      const graphqlPath = `/graphql=${graphqlInfo.backendService}`
      paths.push(graphqlPath)
    }

    await addPathMatcher(
      config.app.projectId,
      config.app.name,
      lbDomain,
      paths,
      true
    )

    await hasLoadBalancerTrue()

    const ip = await getIp(config.app.projectId, networkConf.loadBalancerIpName)
    await createZone(config.app.projectId, config.app.name, nsDomain)
    await createRecord(config.app.projectId, networkConf.zoneName, lbDomain, ip)
    await createCaaRecords(config.app.projectId, networkConf.zoneName, lbDomain)
  } catch (error) {
    Logger.error(`setupLoadBalancer error: ${JSON.stringify(error)}`)
    process.exit(1)
  }
}

const hasLoadBalancerTrue = async () => {
  try {
    const skeetConfig: SkeetCloudConfig = await importConfig()
    skeetConfig.app.hasLoadBalancer = true
    writeFileSync(SKEET_CONFIG_PATH, JSON.stringify(skeetConfig, null, 2))
  } catch (error) {
    throw new Error(`hasLoadBalancerTrue error: ${JSON.stringify(error)}`)
  }
}
