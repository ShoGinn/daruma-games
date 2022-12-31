import { Migration } from '@mikro-orm/migrations';

export class Migration20221230223816 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `algo_wallet` drop `rx_wallet`;');

    this.addSql('alter table `algo_std_token` add `unclaimed_tokens` int null default 0, add `opted_in` tinyint(1) null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `algo_wallet` add `rx_wallet` tinyint(1) not null default false;');

    this.addSql('alter table `algo_std_token` drop `unclaimed_tokens`;');
    this.addSql('alter table `algo_std_token` drop `opted_in`;');
  }

}
