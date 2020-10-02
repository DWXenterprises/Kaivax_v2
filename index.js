const { ShardingManager } = require('discord.js');
const manager = new ShardingManager('./bot.js', { token: 'no' });

manager.on('shardCreate', shard => console.log(`Launched shard ${shard.id}`));
manager.spawn();
