pragma foreign_keys = off;

create table `algo_std_asset` (`id` integer not null, `created_at` datetime not null, `updated_at` datetime not null, `name` text not null, `unit_name` text not null, `url` text not null, `decimals` integer not null default 0, primary key (`id`));

create table `daruma_training_channel` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `message_id` text not null, `game_type` text check (`game_type` in ('OneVsNpc', 'OneVsOne', 'FourVsNpc')) not null, primary key (`id`));

create table `data` (`key` text not null, `created_at` datetime not null, `updated_at` datetime not null, `value` text not null default '', primary key (`key`));

create table `dt_encounters` (`id` integer not null primary key autoincrement, `created_at` datetime not null, `updated_at` datetime not null, `channel_id` text not null, `game_type` text check (`game_type` in ('OneVsNpc', 'OneVsOne', 'FourVsNpc')) not null, `game_data` json not null);

create table `guild` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `prefix` text null, `deleted` integer not null default false, `last_interact` datetime not null, primary key (`id`));

create table `user` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `last_interact` datetime not null, `pre_token` integer not null default 0, primary key (`id`));

create table `algo_wallet` (`address` text not null, `created_at` datetime not null, `updated_at` datetime not null, `owner_id` text not null, constraint `algo_wallet_owner_id_foreign` foreign key(`owner_id`) references `user`(`id`) on update cascade, primary key (`address`));
create index `algo_wallet_owner_id_index` on `algo_wallet` (`owner_id`);

create table `algo_std_token` (`id` integer not null primary key autoincrement, `created_at` datetime not null, `updated_at` datetime not null, `wallet_address` text null, `tokens` integer null, `unclaimed_tokens` integer null default 0, `opted_in` integer null, constraint `algo_std_token_wallet_address_foreign` foreign key(`wallet_address`) references `algo_wallet`(`address`) on delete set null on update cascade);
create index `algo_std_token_wallet_address_index` on `algo_std_token` (`wallet_address`);

create table `algo_std_asset_tokens` (`algo_std_asset_id` integer not null, `algo_std_token_id` integer not null, constraint `algo_std_asset_tokens_algo_std_asset_id_foreign` foreign key(`algo_std_asset_id`) references `algo_std_asset`(`id`) on delete cascade on update cascade, constraint `algo_std_asset_tokens_algo_std_token_id_foreign` foreign key(`algo_std_token_id`) references `algo_std_token`(`id`) on delete cascade on update cascade, primary key (`algo_std_asset_id`, `algo_std_token_id`));
create index `algo_std_asset_tokens_algo_std_asset_id_index` on `algo_std_asset_tokens` (`algo_std_asset_id`);
create index `algo_std_asset_tokens_algo_std_token_id_index` on `algo_std_asset_tokens` (`algo_std_token_id`);

create table `algo_nftasset` (`id` integer not null, `created_at` datetime not null, `updated_at` datetime not null, `creator_address` text not null, `name` text not null, `unit_name` text not null, `url` text not null, `alias` text null, `battle_cry` text null, `wallet_address` text null, `arc69` json null, `dojo_cool_down` datetime null, `dojo_wins` integer not null default 0, `dojo_losses` integer not null default 0, `dojo_zen` integer not null default 0, constraint `algo_nftasset_creator_address_foreign` foreign key(`creator_address`) references `algo_wallet`(`address`) on update cascade, constraint `algo_nftasset_wallet_address_foreign` foreign key(`wallet_address`) references `algo_wallet`(`address`) on delete set null on update cascade, primary key (`id`));
create index `algo_nftasset_creator_address_index` on `algo_nftasset` (`creator_address`);
create index `algo_nftasset_wallet_address_index` on `algo_nftasset` (`wallet_address`);

create table `algo_std_asset_wallet` (`algo_std_asset_id` integer not null, `algo_wallet_address` text not null, constraint `algo_std_asset_wallet_algo_std_asset_id_foreign` foreign key(`algo_std_asset_id`) references `algo_std_asset`(`id`) on delete cascade on update cascade, constraint `algo_std_asset_wallet_algo_wallet_address_foreign` foreign key(`algo_wallet_address`) references `algo_wallet`(`address`) on delete cascade on update cascade, primary key (`algo_std_asset_id`, `algo_wallet_address`));
create index `algo_std_asset_wallet_algo_std_asset_id_index` on `algo_std_asset_wallet` (`algo_std_asset_id`);
create index `algo_std_asset_wallet_algo_wallet_address_index` on `algo_std_asset_wallet` (`algo_wallet_address`);

pragma foreign_keys = on;