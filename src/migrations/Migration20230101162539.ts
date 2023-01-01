import { Migration } from '@mikro-orm/migrations';

export class Migration20230101162539 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `algo_std_asset` drop `token_mnemonic`;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `algo_std_asset` add `token_mnemonic` varchar(255) null;');
  }

}
