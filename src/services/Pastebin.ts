import { Schedule } from '@decorators'
import { Pastebin as PastebinEntity } from '@entities'
import { Database } from '@services'
import dayjs from 'dayjs'
import { Paste, RentryClient } from 'rentry-pastebin'
import { singleton } from 'tsyringe'

@singleton()
export class Pastebin {
  private client: RentryClient = new RentryClient()

  constructor(private db: Database) {
    this.client.createToken().catch(e => {
      throw e
    })
  }

  private async waitForToken(): Promise<void> {
    while (!this.client.getToken()) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  async createPaste(
    content: string,
    lifetime?: number
  ): Promise<Paste | undefined> {
    await this.waitForToken()

    const paste = await this.client.createPaste({ content })

    const pasteEntity = new PastebinEntity()
    pasteEntity.id = paste.url
    pasteEntity.editCode = paste.editCode
    if (lifetime) pasteEntity.lifetime = Math.floor(lifetime)

    await this.db.get(PastebinEntity).persistAndFlush(pasteEntity)

    return paste.paste
  }

  async deletePaste(id: string): Promise<void> {
    await this.waitForToken()

    const paste = await this.db.get(PastebinEntity).findOne({ id })

    if (!paste) return

    this.client.deletePaste(id, paste.editCode)
    this.db.get(PastebinEntity).remove(paste)
  }

  @Schedule('*/30 * * * *')
  private async autoDelete(): Promise<void> {
    const pastes = await this.db
      .get(PastebinEntity)
      .find({ lifetime: { $gt: 0 } })

    for (const paste of pastes) {
      const diff = dayjs().diff(dayjs(paste.createdAt), 'day')

      if (diff >= paste.lifetime) {
        this.client.deletePaste(paste.id, paste.editCode)
      }
    }
  }
}
