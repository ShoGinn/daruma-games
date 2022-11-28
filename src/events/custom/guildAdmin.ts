import { Discord, Guard, On } from '@decorators'
import { Maintenance } from '@guards'
import { Logger } from '@services'
import { Collection, GuildMember, PermissionFlagsBits, Role } from 'discord.js'
import { ArgsOf, Client } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
export default class GuildAdminAddEvent {
  constructor(private logger: Logger) {}

  // =============================
  // ========= Handlers ==========
  // =============================

  @On('guildAdminAdd')
  @Guard(Maintenance)
  async guildAdminAddHandler(
    member: GuildMember,
    _newAdminRoles: Collection<string, Role>,
    _client: Client
  ) {
    await this.logger.log(`${member.nickname} has been added as an admin`)
  }

  @On('guildAdminDelete')
  @Guard(Maintenance)
  async guildAdminDeleteHandler(
    member: GuildMember,
    _oldAdminRoles: Collection<string, Role>,
    _client: Client
  ) {
    await this.logger.log(`${member.nickname} has been removed from admins`)
  }

  // =============================
  // ========== Emitter ==========
  // =============================

  @On('guildMemberUpdate')
  guildAdminEmitter(
    [oldMember, newMember]: ArgsOf<'guildMemberUpdate'>,
    client: Client
  ) {
    if (oldMember.roles.cache.size < newMember.roles.cache.size) {
      const newAdminRoles: Collection<string, Role> =
        newMember.roles.cache.filter(
          role =>
            !oldMember.roles.cache.has(role.id) &&
            role.permissions.has(PermissionFlagsBits.Administrator)
        )
      if (newAdminRoles.size === 0) return

      /**
       * @param {GuildMember} member
       * @param {Collection<String, Role>} newAdminRoles
       */
      client.emit('guildAdminAdd', newMember, newAdminRoles)
    } else if (oldMember.roles.cache.size > newMember.roles.cache.size) {
      const oldAdminRoles: Collection<string, Role> =
        oldMember.roles.cache.filter(
          role =>
            !newMember.roles.cache.has(role.id) &&
            role.permissions.has(PermissionFlagsBits.Administrator)
        )
      if (oldAdminRoles.size === 0) return

      /**
       * @param {GuildMember} member
       * @param {Collection<String, Role>} oldAdminRoles
       */
      client.emit('guildAdminRemove', newMember, oldAdminRoles)
    }
  }
}
